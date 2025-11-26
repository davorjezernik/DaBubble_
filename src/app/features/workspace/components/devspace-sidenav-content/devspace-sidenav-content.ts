import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import {
  Subscription,
  map,
  combineLatest,
  firstValueFrom,
  auditTime,
  debounceTime,
  distinctUntilChanged,
  filter,
} from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import {
  Firestore,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth-service';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { AddUsersToChannel } from '../add-users-to-channel/add-users-to-channel';
import { ChannelItem } from '../channel-item/channel-item';
import { ChannelService } from '../../../../../services/channel-service';
import { ContactItem } from '../contact-item/contact-item';
import { ReadStateService } from '../../../../../services/read-state.service';
import { SearchBusService } from '../../../../../services/search-bus.service';
import { ViewStateService } from '../../../../../services/view-state.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatBottomSheet } from '@angular/material/bottom-sheet';

@Component({
  selector: 'app-devspace-sidenav-content',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSidenavModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    ChannelItem,
    RouterModule,
    ContactItem,
    FormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './devspace-sidenav-content.html',
  styleUrls: ['./devspace-sidenav-content.scss', './devspace-sidenav-content.responsive.scss'],
})
export class DevspaceSidenavContent implements OnInit, OnDestroy {
  users: User[] = [];
  sortedUsers: User[] = [];
  private sub?: Subscription;
  private channelsSub?: Subscription;
  private sortSub?: Subscription;
  private totalUnreadSub?: Subscription;
  private totalUnreadChannelsSub?: Subscription;
  private searchBusSub?: Subscription;

  search = '';
  searchCtrl = new FormControl<string>('', { nonNullable: true }); // 👈 neu
  private searchCtrlSub?: Subscription;

  dmsOpen = true;
  channelsOpen = true;
  currentChatId: string = '';
  totalUnread = 0;
  totalUnreadChannels = 0;

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
    private authService: AuthService,
    private dialog: MatDialog,
    private channelService: ChannelService,
    private read: ReadStateService,
    private searchBus: SearchBusService,
    public viewStateService: ViewStateService,
    public router: Router,
    private bottomSheet: MatBottomSheet
  ) {}

  ngOnInit(): void {
    this.subscribeToUsers();
    this.subscribeToChannels();
    this.subscribeToSearchControl();
    this.subscribeToSearchBus();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.channelsSub?.unsubscribe();
    this.currentUserSub?.unsubscribe();
    this.sortSub?.unsubscribe();
    this.totalUnreadSub?.unsubscribe();
    this.totalUnreadChannelsSub?.unsubscribe();
    this.searchCtrlSub?.unsubscribe();
    this.searchBusSub?.unsubscribe();
  }

  private subscribeToSearchControl(): void {
    this.searchCtrlSub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.searchBus.set(q || ''));
  }

  private subscribeToSearchBus(): void {
    this.searchBusSub = this.searchBus.query$.subscribe((q) => {
      this.search = q;
      if (q) {
        this.maxVisible = this.users.length;
        this.maxVisibleChannels = this.channels.length;
      } else {
        this.maxVisible = Math.min(this.pageSizeUsers, this.users.length);
        this.maxVisibleChannels = Math.min(this.pageSizeChannels, this.channels.length);
      }
      if (q !== this.searchCtrl.value) {
        this.searchCtrl.setValue(q, { emitEvent: false });
      }
    });
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

  private resetTotalUnread() {
    this.totalUnread = 0;
  }

  private buildTotalUnread(list: User[], meUid: string | null) {
    this.totalUnreadSub?.unsubscribe();
    if (!meUid) return this.resetTotalUnread();
    this.processDmSubscription(list, meUid);
  }

  private processDmSubscription(list: User[], meUid: string) {
    const others = list.filter((u) => u.uid !== meUid);

    if (!others.length) return this.resetTotalUnread();

    this.subscribeToDmUnreadCounts(others, meUid);
  }

  private subscribeToDmUnreadCounts(others: User[], meUid: string) {
    const streams = others.map((u) => {
      const dmId = this.calculateDmId(u);
      return this.read.unreadDmCount$(dmId, meUid);
    });

    this.totalUnreadSub = combineLatest(streams)
      .pipe(map((arr) => arr.reduce((sum, n) => sum + (n || 0), 0)))
      .subscribe((sum) => (this.totalUnread = sum));
  }

  private setSortedUsers(list: User[]) {
    this.sortedUsers = list;
  }

  private computeSortedUsers(me: User | null) {
    this.sortedUsers = me ? [me] : [];
  }

  private buildSortedUsers(list: User[], meUid: string | null) {
    this.sortSub?.unsubscribe();

    if (!meUid) return this.setSortedUsers(list);

    const me = list.find((u) => (u.uid = meUid)) || null;
    const others = list.filter((u) => u.uid != meUid);

    if (!others.length) return this.computeSortedUsers(me);

    this.subscribeToUserSort(others, me, meUid);
  }

  private subscribeToUserSort(others: User[], me: User | null, meUid: string) {
    const metaStreams = this.createMetaStreams(others, meUid);

    this.sortSub = combineLatest(metaStreams)
      .pipe(auditTime(16))
      .subscribe((metaArr) => this.handleSortUpdate(metaArr, others, me));
  }

  private handleSortUpdate(metaArr: any[], others: User[], me: User | null) {
    const metaMap = new Map(metaArr.map((x) => [x.uid, x.meta]));
    const sortedOthers = [...others].sort((a, b) => this.compareUsers(a, b, metaMap));

    this.sortedUsers = me ? [me, ...sortedOthers] : sortedOthers;
    this.maxVisible = Math.min(this.maxVisible, this.sortedUsers.length);
  }

  private createMetaStreams(others: User[], meUid: string) {
    return others.map((u) => {
      const dmId = this.calculateDmId(u);
      return this.read.dmMeta$(dmId, meUid).pipe(map((meta) => ({ uid: u.uid, meta })));
    });
  }

  private compareUsers(a: User, b: User, metaMap: Map<string, any>): number {
    const ma = metaMap.get(a.uid) || { unread: 0, lastMessageAt: 0 };
    const mb = metaMap.get(b.uid) || { unread: 0, lastMessageAt: 0 };

    return (
      this.compareByUnread(ma, mb) ||
      this.compareByTime(ma, mb) ||
      this.compareByName(a, b) ||
      String(a.uid).localeCompare(String(b.uid))
    );
  }

  private compareByUnread(ma: any, mb: any): number {
    return (mb.unread > 0 ? 1 : 0) - (ma.unread > 0 ? 1 : 0);
  }

  private compareByTime(ma: any, mb: any): number {
    return mb.lastMessageAt - ma.lastMessageAt;
  }

  private compareByName(a: User, b: User): number {
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, {
      sensitivity: 'base',
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
      this.maxVisible = this.users.length;
    } else {
      this.maxVisible = Math.min(this.pageSizeUsers, this.users.length);
    }
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

  private norm(s: any): string {
    const str = String(s ?? '').toLowerCase();
    try {
      return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
  }

  private matches(hay: any, q: string): boolean {
    if (!q) return true;
    const H = this.norm(hay);
    const Q = this.norm(q);
    return H.includes(Q);
  }

  get visibleUsers(): User[] {
    const base = this.sortedUsers.length ? this.sortedUsers : this.users;

    if (!this.search) {
      return base.slice(0, Math.min(this.maxVisible, base.length));
    }

    const me = base[0] && this.meUid && base[0].uid === this.meUid ? base[0] : null;
    const others = me ? base.slice(1) : base;

    const filteredOthers = others.filter((u) => this.matches(u.name, this.search));
    return me && this.matches(me.name, this.search) ? [me, ...filteredOthers] : filteredOthers;
  }

  get visibleChannels() {
    const base = this.channels ?? [];
    if (!this.search) {
      return base.slice(0, Math.min(this.maxVisibleChannels, base.length));
    }
    return base.filter((c) => this.matches(c.name, this.search));
  }

  get hiddenCount(): number {
    if (this.search) return 0;
    const base = this.sortedUsers.length ? this.sortedUsers : this.users;
    return Math.max(base.length - this.maxVisible, 0);
  }

  get hiddenChannelsCount() {
    if (this.search) return 0;
    const base = this.channels ?? [];
    return Math.max(base.length - this.maxVisibleChannels, 0);
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

  get isMobileView(): boolean {
    return window.innerWidth < 500;
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
