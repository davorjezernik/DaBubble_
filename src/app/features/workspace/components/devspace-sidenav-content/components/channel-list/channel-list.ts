import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ChannelItem } from '../../../channel-item/channel-item';
import { combineLatest, firstValueFrom, map, Subscription } from 'rxjs';
import { User } from '../../../../../../../models/user.class';
import { stringMatches } from '../../../../../../shared/utils/search-utils';
import { collection, doc, Firestore, serverTimestamp, writeBatch } from '@angular/fire/firestore';
import { AuthService } from '../../../../../../../services/auth-service';
import { ViewStateService } from '../../../../../../../services/view-state.service';
import { ReadStateService } from '../../../../../../../services/read-state.service';
import { UserService } from '../../../../../../../services/user.service';
import { ChannelService } from '../../../../../../../services/channel-service';
import { AddUsersToChannel } from '../../../add-users-to-channel/add-users-to-channel';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../../../add-channel/add-channel';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-channel-list',
  imports: [CommonModule ,ChannelItem],
  templateUrl: './channel-list.html',
  styleUrl: './channel-list.scss',
})
export class ChannelList implements OnInit, OnDestroy, OnChanges {
  @Input() users: User[] = [];
  @Input() meUid: string | null = null;
  @Input() search: string = '';
  @Input() channels: any[] = [];

  private channelsSub?: Subscription;
  private totalUnreadChannelsSub?: Subscription;
  private sub?: Subscription;

  channelsOpen = true;
  totalUnreadChannels = 0;

  pageSizeChannels = 5;
  maxVisibleChannels = this.pageSizeChannels;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    public viewStateService: ViewStateService,
    private read: ReadStateService,
    private usersService: UserService,
    private channelService: ChannelService,
    private bottomSheet: MatBottomSheet,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.subscribeToUsers();
    this.subscribeToChannels();
  }

  ngOnDestroy(): void {
    this.channelsSub?.unsubscribe();
    this.totalUnreadChannelsSub?.unsubscribe();
    this.sub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['search']) {
      this.handleSearchChange();
    }
    if (changes['meUid']) {
      this.buildTotalUnreadChannels(this.channels, this.meUid);
    }
  }

  get isMobileView(): boolean {
    return window.innerWidth < 500;
  }

  get visibleChannels() {
    const base = this.channels ?? [];
    if (!this.search) {
      return base.slice(0, Math.min(this.maxVisibleChannels, base.length));
    }
    return base.filter((c) => stringMatches(c.name, this.search));
  }

  get hiddenChannelsCount() {
    if (this.search) return 0;
    const base = this.channels ?? [];
    return Math.max(base.length - this.maxVisibleChannels, 0);
  }

  private handleSearchChange() {
    if (this.search) {
      this.maxVisibleChannels = this.channels.length;
    } else {
      this.maxVisibleChannels = Math.min(this.pageSizeChannels, this.channels.length);
    }
  }

  private subscribeToUsers(): void {
    this.sub = combineLatest([
      this.usersService.users$(),
      this.usersService.currentUser$(),
    ]).subscribe(([list, me]) => {
      this.meUid = me?.uid ?? null;
      this.updateUserList(list);
      this.buildTotalUnreadChannels(this.channels, this.meUid);
    });
  }

    private updateUserList(list: any[]): void {
    if (this.meUid) {
      const meUser = list.find((u) => u.uid === this.meUid);
      const others = list.filter((u) => u.uid !== this.meUid);
      this.users = meUser ? [meUser, ...others] : list;
    } else {
      this.users = list;
    }

    if (this.search) {
      this.viewStateService.maxVisible = this.users.length;
    } else {
      this.viewStateService.maxVisible = Math.min(
        this.viewStateService.pageSizeUsers,
        this.users.length
      );
    }
  }

  private resetTotalUnreadChannels() {
    this.totalUnreadChannels = 0;
  }

  private buildTotalUnreadChannels(channels: any[], meUid: string | null) {
    this.totalUnreadChannelsSub?.unsubscribe();
    if (!meUid) return this.resetTotalUnreadChannels();

    const myChannels = this.filterMyChannels(channels, meUid);

    if (!myChannels.length) return this.resetTotalUnreadChannels();
    this.subscribeToChannelUnreadCounts(myChannels, meUid);
  }

  private subscribeToChannelUnreadCounts(myChannels: any[], meUid: string) {
    const streams = myChannels.map((c) => this.read.unreadChannelCount$(c.id, meUid));
    this.totalUnreadChannelsSub = combineLatest(streams)
      .pipe(map((arr) => arr.reduce((s, n) => s + (n || 0), 0)))
      .subscribe((sum) => (this.totalUnreadChannels = sum));
  }

  private filterMyChannels(channels: any[], meUid: string): any[] {
    return (channels ?? []).filter((c) =>
      c?.members?.some((m: any) => (typeof m === 'string' ? m : m?.uid) === meUid)
    );
  }

  private subscribeToChannels(): void {
    this.channelsSub = combineLatest([
      this.channelService.getChannels(),
      this.authService.currentUser$,
    ]).subscribe(([channels, user]) => {
      const userChannels = this.filterUserChannels(channels, user?.uid);
      this.channels = this.sortChannels(userChannels);

      if (this.search) {
        this.maxVisibleChannels = this.channels.length;
      } else {
        this.maxVisibleChannels = Math.min(this.pageSizeChannels, this.channels.length);
      }

      this.buildTotalUnreadChannels(this.channels, this.meUid);
    });
  }

  private filterUserChannels(channels: any[], userId: any): any[] {
    return channels.filter(
      (channel) => channel.members && channel.members.some((member: any) => member.uid === userId)
    );
  }

  private sortChannels(channels: any[]): any[] {
    return channels.sort((a: any, b: any) => {
      if (a.name?.toLowerCase() === 'everyone') return -1;
      if (b.name?.toLowerCase() === 'everyone') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  loadMoreChannels() {
    this.maxVisibleChannels = Math.min(
      this.maxVisibleChannels + this.pageSizeChannels,
      this.channels.length
    );
  }
  openAddChannel() {
    if (this.isMobileView) {
      this.openMobileAddChannel();
    } else {
      this.openDesktopAddChannel();
    }
  }

  private openMobileAddChannel() {
    const sheetRef = this.bottomSheet.open(AddChannel, {
      panelClass: 'mobile-channel-sheet',
    });
    sheetRef.afterDismissed().subscribe((result) => this.handleChannelResult(result));
  }

  private openDesktopAddChannel() {
    const dialogRef = this.dialog.open(AddChannel, {
      panelClass: 'sheet-400',
      width: '480px',
      maxWidth: '95vw',
    });
    dialogRef.afterClosed().subscribe((result) => this.handleChannelResult(result));
  }

  private handleChannelResult(result: any) {
    if (result && result.channelName) {
      this.openAddUsersToChannelDialog(result);
    }
  }

  openAddUsersToChannelDialog(data: any) {
    if (this.isMobileView) {
      this.openAddUsersSheet(data);
    } else {
      this.openAddUsersDialog(data);
    }
  }

  private openAddUsersSheet(data: any) {
    const sheetRef = this.bottomSheet.open(AddUsersToChannel, {
      panelClass: 'mobile-channel-sheet',
      data: data,
    });

    sheetRef.afterDismissed().subscribe((result) => this.handleUsersResult(result));
  }

  private openAddUsersDialog(data: any) {
    const dialogRef = this.dialog.open(AddUsersToChannel, {
      panelClass: 'sheet-400',
      width: '480px',
      maxWidth: '95vw',
      data: data,
    });

    dialogRef.afterClosed().subscribe((result) => this.handleUsersResult(result));
  }

  private handleUsersResult(result: any) {
    if (result) {
      this.saveChannelData(result);
    }
  }

  async saveChannelData(result: any) {
    const currentUser = await firstValueFrom(this.authService.currentUser$);

    const newChannelRef = doc(collection(this.firestore, 'channels'));
    const channelData = this.prepareChannelData(result, currentUser);

    await this.executeChannelSave(newChannelRef, channelData);
  }

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

  private async executeChannelSave(docRef: any, data: any) {
    const batch = writeBatch(this.firestore);
    batch.set(docRef, data);
    await batch.commit();
  }
}
