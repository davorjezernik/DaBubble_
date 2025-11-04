import { Component, OnDestroy, OnInit, Injectable, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import {
  Observable,
  Subscription,
  combineLatest,
  of,
  map,
  switchMap,
  filter,
  debounceTime,
  startWith,
  distinctUntilChanged,
  firstValueFrom 
} from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Router, RouterModule, ActivatedRoute, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../../../services/auth-service';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { AddUsersToChannel } from '../add-users-to-channel/add-users-to-channel';
import { ChannelItem } from '../channel-item/channel-item';
import { ChannelService } from '../../../../../services/channel-service';
import { ContactItem } from '../contact-item/contact-item';
import { UnreadService } from '../../../../../services/unread.service';

@Component({
  selector: 'app-devspace-sidenav-content',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSidenavModule,
    CommonModule,
    FormsModule,
    MatDialogModule,
    ChannelItem,
    RouterModule,
    ContactItem,
  ],
  templateUrl: './devspace-sidenav-content.html',
  styleUrl: './devspace-sidenav-content.scss',
})
export class DevspaceSidenavContent implements OnInit, OnDestroy {
  users: User[] = [];
  private sub?: Subscription;
  private channelsSub?: Subscription;

  dmsOpen = true;
  channelsOpen = true;
  currentChatId: string = '';
  unreadByUid: Record<string, Observable<number>> = {};
  totalDmUnread$: Observable<number> = of(0);
  activeDmId$: Observable<string> = of('');

  // Users//

  pageSizeUsers = 4;
  maxVisible = this.pageSizeUsers;

  pageSizeChannels = 5;
  maxVisibleChannels = this.pageSizeChannels;

  activeIndex: number | null = null;

  meUid: string | null = null;

  channels: any[] = [];
  private currentUserSub?: Subscription;

  constructor(
    private usersService: UserService,
    private firestore: Firestore,
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private channelService: ChannelService,
    private unread: UnreadService
  ) {}

  ngOnInit(): void {
    this.subscribeToUsers();
    this.subscribeToChannels();
    this.activeDmId$ = this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        const m = this.router.url.match(/\/workspace\/dm\/([^\/\?]+)/i);
        return m ? decodeURIComponent(m[1]) : '';
      })
    );
  }

  private subscribeToUsers(): void {
    this.sub = combineLatest([
      this.usersService.users$(),
      this.usersService.currentUser$(),
    ]).subscribe(([list, me]) => {
      this.meUid = me?.uid ?? null;
      this.updateUserList(list);
    });
  }

  // Unread count //
  private buildPerUserUnreadStreams(): void {
    this.unreadByUid = {};
    if (!this.meUid) return;

    for (const u of this.users) {
      if (!u?.uid || u.uid === this.meUid) continue;
      const dmId = this.calculateDmId(u);
      if (!dmId) continue;

      const base$ = this.unread.unreadCount$('dms', dmId, this.meUid!);
      this.unreadByUid[u.uid] = combineLatest([base$, this.activeDmId$.pipe(startWith(''))]).pipe(
        map(([n, activeId]) => (activeId === dmId ? 0 : n || 0)),
        distinctUntilChanged()
      );
    }
  }

  private buildTotalUnreadStream(): void {
    if (!this.meUid) {
      this.totalDmUnread$ = of(0);
      return;
    }

    const entries = Object.entries(this.unreadByUid);

    this.totalDmUnread$ = this.activeDmId$.pipe(
      startWith(''),
      map((dmId) => this.otherUidFromDmId(dmId, this.meUid!)),
      switchMap((activeOtherUid) => {
        const streams = entries
          .filter(([uid]) => uid !== activeOtherUid) 
          .map(([, obs$]) => obs$);

        return streams.length
          ? combineLatest(streams).pipe(map((arr) => arr.reduce((sum, n) => sum + (n || 0), 0)))
          : of(0);
      }),
      debounceTime(30),
      distinctUntilChanged()
    );
  }

  private buildUnreadMap(): void {
    this.buildPerUserUnreadStreams();
    this.buildTotalUnreadStream();
  }
  // Unread count //

  private otherUidFromDmId(dmId: string, meUid: string): string | null {
    const [a, b] = dmId.split('-');
    if (!a || !b) return null;
    return a === meUid ? b : b === meUid ? a : null;
  }

  private updateUserList(list: any[]): void {
    if (this.meUid) {
      const meUser = list.find((u) => u.uid === this.meUid);
      const others = list.filter((u) => u.uid !== this.meUid);
      this.users = meUser ? [meUser, ...others] : list;
    } else {
      this.users = list;
    }

    this.buildUnreadMap();

    this.maxVisible = Math.min(this.maxVisible, this.users.length);
  }

  private subscribeToChannels(): void {
    this.channelsSub = combineLatest([
      this.channelService.getChannels(),
      this.authService.currentUser$,
    ]).subscribe(([channels, user]) => {
      const userChannels = this.filterUserChannels(channels, user?.uid);
      this.channels = this.sortChannels(userChannels);
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.channelsSub?.unsubscribe();
    this.currentUserSub?.unsubscribe();
  }

  get visibleUsers(): User[] {
    return this.users.slice(0, Math.min(this.maxVisible, this.users.length));
  }

  get visibleChannels() {
    return (this.channels ?? []).slice(0, Math.min(this.maxVisibleChannels, this.channels.length));
  }

  get hiddenCount(): number {
    return Math.max(this.users.length - this.maxVisible, 0);
  }

  get hiddenChannelsCount() {
    return Math.max((this.channels?.length ?? 0) - this.maxVisibleChannels, 0);
  }

  loadMore(): void {
    this.maxVisible = Math.min(this.maxVisible + this.pageSizeUsers, this.users.length);
  }

  loadMoreChannels() {
    this.maxVisibleChannels = Math.min(
      this.maxVisibleChannels + this.pageSizeChannels,
      this.channels.length
    );
  }

  calculateDmId(otherUser: User): string {
    if (!this.meUid) return '';
    const uid1 = this.meUid;
    const uid2 = otherUser.uid;
    return uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;
  }

  async ensureDmExists(otherUser: User) {
    const user: any = await firstValueFrom(this.authService.currentUser$);
    if (!user) return;

    const uid1 = user.uid;
    const uid2 = otherUser.uid;

    this.currentChatId = uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;

    const docRef = doc(this.firestore, 'dms', this.currentChatId);

    await setDoc(docRef, { members: [uid1, uid2] }, { merge: true });
  }

  trackById = (_: number, u: User) => u.uid;

  openAddChannelDialog() {
    const dialogRef = this.dialog.open(AddChannel, {
      panelClass: 'dialog-panel',
      width: '80vw',
      maxWidth: '800px',
      minWidth: '300px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.channelName) {
        this.openAddUsersToChannelDialog(result);
      }
    });
  }

  openAddUsersToChannelDialog(result: any) {
    const addUsersDialogRef = this.dialog.open(AddUsersToChannel, {
      panelClass: 'dialog-panel',
      width: '80vw',
      maxWidth: '750px',
      minWidth: '300px',
      data: result,
    });
    addUsersDialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        this.saveChannelData(dialogResult);
      }
    });
  }

  async saveChannelData(dialogResult: any) {
    const batch = writeBatch(this.firestore);
    const { channel, users } = dialogResult;
    const channelsRef = collection(this.firestore, 'channels');
    const channelDoc = doc(channelsRef);

    const currentUser = await firstValueFrom(this.authService.currentUser$);

    batch.set(channelDoc, {
      name: channel.channelName,
      description: channel.description,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.displayName,
      members: users.map((user: any) => ({
        uid: user.uid,
        displayName: user.displayName,
      })),
    });

    await batch.commit();
  }
}
