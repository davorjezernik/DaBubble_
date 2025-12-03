import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ChannelItem } from '../../../channel-item/channel-item';
import { combineLatest, firstValueFrom, map, Subscription, auditTime } from 'rxjs';
import { stringMatches } from '../../../../../../shared/utils/search-utils';
import { collection, doc, Firestore, serverTimestamp, writeBatch } from '@angular/fire/firestore';
import { AuthService } from '../../../../../../../services/auth-service';
import { ViewStateService } from '../../../../../../../services/view-state.service';
import { ReadStateService } from '../../../../../../../services/read-state.service';
import { ChannelService } from '../../../../../../../services/channel-service';
import { AddUsersToChannel } from '../../../add-users-to-channel/add-users-to-channel';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../../../add-channel/add-channel';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-channel-list',
  imports: [CommonModule, ChannelItem],
  templateUrl: './channel-list.html',
  styleUrl: './channel-list.scss',
})
/**
 * Shows the list of channels the user is a member of.
 * Handles unread counts, search and creation of new channels.
 */
export class ChannelList implements OnInit, OnDestroy, OnChanges {
  /** UID of the currently logged-in user. */
  @Input() meUid: string | null = null;
  /** Current search query string for filtering channels by name. */
  @Input() search: string = '';
  /** List of channels visible to the user. */
  @Input() channels: any[] = [];

  private channelsSub?: Subscription;
  private totalUnreadChannelsSub?: Subscription;

  channelsOpen = true;
  totalUnreadChannels = 0;

  pageSizeChannels = 5;
  maxVisibleChannels = this.pageSizeChannels;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    public viewStateService: ViewStateService,
    private read: ReadStateService,
    private channelService: ChannelService,
    private bottomSheet: MatBottomSheet,
    private dialog: MatDialog
  ) {}

  /**
   * Lifecycle hook called after component creation.
   * Starts subscription to the channel list.
   */
  ngOnInit(): void {
    this.subscribeToChannels();
  }

  /**
   * Lifecycle hook called just before the component is destroyed.
   * Cleans up channel-related subscriptions.
   */
  ngOnDestroy(): void {
    this.channelsSub?.unsubscribe();
    this.totalUnreadChannelsSub?.unsubscribe();
  }

  /**
   * Reacts to input changes.
   * Rebuilds unread counters when `meUid` changes and
   * adjusts pagination when `search` changes.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['search']) {
      this.handleSearchChange();
    }
    if (changes['meUid']) {
      this.buildTotalUnreadChannels(this.channels, this.meUid);
    }
  }

  /** True if the viewport is considered mobile-sized. */
  get isMobileView(): boolean {
    return window.innerWidth < 500;
  }

  /**
   * Channels visible in the UI, after applying search and pagination.
   */
  get visibleChannels() {
    const base = this.channels ?? [];
    if (!this.search) {
      return base.slice(0, Math.min(this.maxVisibleChannels, base.length));
    }
    return base.filter((c) => stringMatches(c.name, this.search));
  }

  /**
   * Number of channels that are hidden below the current visible range.
   */
  get hiddenChannelsCount() {
    if (this.search) return 0;
    const base = this.channels ?? [];
    return Math.max(base.length - this.maxVisibleChannels, 0);
  }

  /**
   * Adjusts the maximum number of visible channels when the search
   * query changes.
   */
  private handleSearchChange() {
    if (this.search) {
      this.maxVisibleChannels = this.channels.length;
    } else {
      this.maxVisibleChannels = Math.min(this.pageSizeChannels, this.channels.length);
    }
  }

  /** Resets the total unread channel counter back to zero. */
  private resetTotalUnreadChannels() {
    this.totalUnreadChannels = 0;
  }

  /**
   * Builds the total unread channels counter for the current user.
   * @param channels All available channels.
   * @param meUid UID of the current user.
   */
  private buildTotalUnreadChannels(channels: any[], meUid: string | null) {
    this.totalUnreadChannelsSub?.unsubscribe();
    if (!meUid) return this.resetTotalUnreadChannels();

    const myChannels = this.filterMyChannels(channels, meUid);

    if (!myChannels.length) return this.resetTotalUnreadChannels();
    this.subscribeToChannelUnreadCounts(myChannels, meUid);
  }

  /**
   * Subscribes to unread-count streams for each of the user's channels
   * and sums the values into `totalUnreadChannels`.
   * Only subscribes to visible channels (TIER 3, Fix 8)
   */
  private subscribeToChannelUnreadCounts(myChannels: any[], meUid: string) {
    // Nur sichtbare Channels laden (TIER 3, Fix 8)
    const visibleChannels = myChannels.slice(0, this.maxVisibleChannels);
    const streams = visibleChannels.map((c) => this.read.unreadChannelCount$(c.id, meUid));
    
    if (!streams.length) {
      this.totalUnreadChannels = 0;
      return;
    }
    
    this.totalUnreadChannelsSub = combineLatest(streams)
      .pipe(
        auditTime(500), // ← Debouncing (TIER 3, Fix 8)
        map((arr) => arr.reduce((s, n) => s + (n || 0), 0))
      )
      .subscribe((sum) => (this.totalUnreadChannels = sum));
  }

  /**
   * Filters channels to only those where the current user is a member.
   */
  private filterMyChannels(channels: any[], meUid: string): any[] {
    return (channels ?? []).filter((c) =>
      c?.members?.some((m: any) => (typeof m === 'string' ? m : m?.uid) === meUid)
    );
  }

  /**
   * Subscribes to channels and current user streams, then processes
   * channel snapshots for display.
   */
  private subscribeToChannels(): void {
    this.channelsSub = combineLatest([
      this.channelService.getChannels(),
      this.authService.currentUser$,
    ]).subscribe(([channels, user]) => {
      this.processChannelSnapshot(channels, user);
    });
  }

  /**
   * Applies filtering, sorting and pagination to a new channel snapshot.
   */
  private processChannelSnapshot(channels: any[], user: any) {
    const userChannels = this.filterUserChannels(channels, user?.uid);
    this.channels = this.sortChannels(userChannels);

    if (this.search) {
      this.maxVisibleChannels = this.channels.length;
    } else {
      this.maxVisibleChannels = Math.min(this.pageSizeChannels, this.channels.length);
    }

    this.buildTotalUnreadChannels(this.channels, this.meUid);
  }

  /**
   * Filters channels down to those where the given user ID is a member.
   */
  private filterUserChannels(channels: any[], userId: any): any[] {
    return channels.filter(
      (channel) => channel.members && channel.members.some((member: any) => member.uid === userId)
    );
  }

  /**
   * Sorts channels by name, while always putting the "everyone" channel first.
   */
  private sortChannels(channels: any[]): any[] {
    return channels.sort((a: any, b: any) => {
      if (a.name?.toLowerCase() === 'everyone') return -1;
      if (b.name?.toLowerCase() === 'everyone') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Increases the number of visible channels by one "page".
   * Reloads unread counts for newly visible items (TIER 3, Fix 8)
   */
  public loadMoreChannels() {
    this.maxVisibleChannels = Math.min(
      this.maxVisibleChannels + this.pageSizeChannels,
      this.channels.length
    );
    // Unread Counts für neue sichtbare Channels laden
    this.buildTotalUnreadChannels(this.channels, this.meUid);
  }
  /**
   * Opens the "add channel" flow, using a dialog on desktop
   * or a bottom sheet on mobile.
   */
  public openAddChannel() {
    if (this.isMobileView) {
      this.openMobileAddChannel();
    } else {
      this.openDesktopAddChannel();
    }
  }

  /** Opens the add-channel bottom sheet on mobile devices. */
  private openMobileAddChannel() {
    const sheetRef = this.bottomSheet.open(AddChannel, {
      panelClass: 'mobile-channel-sheet',
    });
    sheetRef.afterDismissed().subscribe((result) => this.handleChannelResult(result));
  }

  /** Opens the add-channel dialog on larger screens. */
  private openDesktopAddChannel() {
    const dialogRef = this.dialog.open(AddChannel, {
      panelClass: 'sheet-400',
      width: '480px',
      maxWidth: '95vw',
    });
    dialogRef.afterClosed().subscribe((result) => this.handleChannelResult(result));
  }

  /**
   * Handles the result of the add-channel dialog/sheet.
   * If a channel name was provided, continues with selecting users.
   */
  private handleChannelResult(result: any) {
    if (result && result.channelName) {
      this.openAddUsersToChannelDialog(result);
    }
  }

  /**
   * Starts the "add users to channel" flow in either a dialog
   * or a bottom sheet depending on viewport.
   */
  private openAddUsersToChannelDialog(data: any) {
    if (this.isMobileView) {
      this.openAddUsersSheet(data);
    } else {
      this.openAddUsersDialog(data);
    }
  }

  /** Opens the add-users bottom sheet on mobile devices. */
  private openAddUsersSheet(data: any) {
    const sheetRef = this.bottomSheet.open(AddUsersToChannel, {
      panelClass: 'mobile-channel-sheet',
      data: data,
    });

    sheetRef.afterDismissed().subscribe((result) => this.handleUsersResult(result));
  }

  /** Opens the add-users dialog on larger screens. */
  private openAddUsersDialog(data: any) {
    const dialogRef = this.dialog.open(AddUsersToChannel, {
      panelClass: 'sheet-400',
      width: '480px',
      maxWidth: '95vw',
      data: data,
    });

    dialogRef.afterClosed().subscribe((result) => this.handleUsersResult(result));
  }

  /**
   * Handles the result from the add-users step.
   * If users were selected, saves channel data to Firestore.
   */
  private handleUsersResult(result: any) {
    if (result) {
      this.saveChannelData(result);
    }
  }

  /**
   * Saves the newly created channel and its members to Firestore.
   * @param result Combined channel and user data coming from the dialog/sheet.
   */
  async saveChannelData(result: any) {
    const currentUser = await firstValueFrom(this.authService.currentUser$);

    const newChannelRef = doc(collection(this.firestore, 'channels'));
    const channelData = this.prepareChannelData(result, currentUser);

    await this.executeChannelSave(newChannelRef, channelData);
  }

  /**
   * Prepares the data object for a new channel document.
   */
  private prepareChannelData(result: any, currentUser: any) {
    const { channel, users } = result;
    return {
      name: channel.channelName,
      description: channel.description,
      createdAt: serverTimestamp(),
      createdBy: currentUser.displayName,
      members: users.map((user: any) => ({
        uid: user.uid,
        displayName: user.displayName,
      })),
    };
  }

  /**
   * Writes the channel document using a Firestore batch.
   */
  private async executeChannelSave(docRef: any, data: any) {
    const batch = writeBatch(this.firestore);
    batch.set(docRef, data);
    await batch.commit();
  }
}
