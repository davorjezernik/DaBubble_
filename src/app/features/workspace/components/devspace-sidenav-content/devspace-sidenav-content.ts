import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Observable, Subscription, map, of, combineLatest, firstValueFrom, auditTime } from 'rxjs';
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
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth-service';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { AddUsersToChannel } from '../add-users-to-channel/add-users-to-channel';
import { ChannelItem } from '../channel-item/channel-item';
import { ChannelService } from '../../../../../services/channel-service';
import { ContactItem } from '../contact-item/contact-item';
import { ReadStateService } from '../../../../../services/read-state.service';

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
  sortedUsers: User[] = [];
  private sub?: Subscription;
  private channelsSub?: Subscription;
  private sortSub?: Subscription;
  private totalUnreadSub?: Subscription;
  private totalUnreadChannelsSub?: Subscription;

  dmsOpen = true;
  channelsOpen = true;
  currentChatId: string = '';
  totalUnread = 0;
  totalUnreadChannels = 0;

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
    private read: ReadStateService
  ) {}

  ngOnInit(): void {
    this.subscribeToUsers();
    this.subscribeToChannels();
  }

  private subscribeToUsers(): void {
    this.sub = combineLatest([
      this.usersService.users$(),
      this.usersService.currentUser$(),
    ]).subscribe(([list, me]) => {
      this.meUid = me?.uid ?? null;
      this.updateUserList(list);
      this.buildSortedUsers(list, this.meUid);
      this.buildTotalUnread(list, this.meUid);

      this.buildTotalUnreadChannels(this.channels, this.meUid);
    });
  }

  // total count for channels //
  private buildTotalUnreadChannels(channels: any[], meUid: string | null) {
    this.totalUnreadChannelsSub?.unsubscribe();
    if (!meUid) {
      this.totalUnreadChannels = 0;
      return;
    }

    const myChannels = (channels ?? []).filter((c) =>
      c?.members?.some((m: any) => (typeof m === 'string' ? m : m?.uid) === meUid)
    );
    if (!myChannels.length) {
      this.totalUnreadChannels = 0;
      return;
    }

    const streams = myChannels.map((c) => this.read.unreadChannelCount$(c.id, meUid));
    this.totalUnreadChannelsSub = combineLatest(streams)
      .pipe(map((arr) => arr.reduce((s, n) => s + (n || 0), 0)))
      .subscribe((sum) => (this.totalUnreadChannels = sum));
  }
  // total count for channels //
  
  // for total cound by Direkt messasges //
  private buildTotalUnread(list: User[], meUid: string | null) {
    this.totalUnreadSub?.unsubscribe();

    if (!meUid) {
      this.totalUnread = 0;
      return;
    }

    const others = list.filter((u) => u.uid !== meUid);
    if (!others.length) {
      this.totalUnread = 0;
      return;
    }

    const streams = others.map((u) => {
      const dmId = this.calculateDmId(u);
      return this.read.unreadDmCount$(dmId, meUid);
    });

    this.totalUnreadSub = combineLatest(streams)
      .pipe(
        map((arr) => arr.reduce((sum, n) => sum + (n || 0), 0)),
        auditTime(16)
      )
      .subscribe((sum) => (this.totalUnread = sum));
  }
  // for total cound by Direkt messasges //

  // for sorting by unread messages //
  private buildSortedUsers(list: User[], meUid: string | null) {
    this.sortSub?.unsubscribe();

    if (!meUid) {
      this.sortedUsers = list;
      return;
    }

    const myId = meUid as string;

    const me = list.find((u) => u.uid === myId) || null;
    const others = list.filter((u) => u.uid !== myId);

    if (!others.length) {
      this.sortedUsers = me ? [me] : [];
      return;
    }

    const metaStreams = others.map((u) => {
      const dmId = this.calculateDmId(u);
      return this.read.dmMeta$(dmId, myId).pipe(map((meta) => ({ uid: u.uid, meta })));
    });

    this.sortSub = combineLatest(metaStreams)
      .pipe(auditTime(16))
      .subscribe((metaArr) => {
        const metaMap = new Map(metaArr.map((x) => [x.uid, x.meta]));

        const sortedOthers = [...others].sort((a, b) => {
          const ma = metaMap.get(a.uid) || { unread: 0, lastMessageAt: 0 };
          const mb = metaMap.get(b.uid) || { unread: 0, lastMessageAt: 0 };

          const aHas = ma.unread > 0 ? 1 : 0;
          const bHas = mb.unread > 0 ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;

          if (ma.lastMessageAt !== mb.lastMessageAt) return mb.lastMessageAt - ma.lastMessageAt;

          const nameCmp = String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, {
            sensitivity: 'base',
          });
          if (nameCmp !== 0) return nameCmp;

          return String(a.uid).localeCompare(String(b.uid));
        });

        this.sortedUsers = me ? [me, ...sortedOthers] : sortedOthers;
        this.maxVisible = Math.min(this.maxVisible, this.sortedUsers.length);
      });
  }
  // for sorting by unread messages //

  private updateUserList(list: any[]): void {
    if (this.meUid) {
      const meUser = list.find((u) => u.uid === this.meUid);
      const others = list.filter((u) => u.uid !== this.meUid);
      this.users = meUser ? [meUser, ...others] : list;
    } else {
      this.users = list;
    }

    this.maxVisible = Math.min(this.maxVisible, this.users.length);
  }

  private subscribeToChannels(): void {
    this.channelsSub = combineLatest([
      this.channelService.getChannels(),
      this.authService.currentUser$,
    ]).subscribe(([channels, user]) => {
      const userChannels = this.filterUserChannels(channels, user?.uid);
      this.channels = this.sortChannels(userChannels);
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.channelsSub?.unsubscribe();
    this.currentUserSub?.unsubscribe();
    this.sortSub?.unsubscribe();
    this.totalUnreadSub?.unsubscribe();
    this.totalUnreadChannelsSub?.unsubscribe();
  }

  get visibleUsers(): User[] {
    const base = this.sortedUsers.length ? this.sortedUsers : this.users;
    return base.slice(0, Math.min(this.maxVisible, base.length));
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
