import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { User } from '../../../../../../../models/user.class';
import { auditTime, combineLatest, firstValueFrom, map, Subscription } from 'rxjs';
import { doc, Firestore, setDoc } from '@angular/fire/firestore';
import { UserService } from '../../../../../../../services/user.service';
import { AuthService } from '../../../../../../../services/auth-service';
import { ViewStateService } from '../../../../../../../services/view-state.service';
import { ContactItem } from '../../../contact-item/contact-item';
import { RouterModule } from '@angular/router';
import { stringMatches } from '../../../../../../shared/utils/search-utils';
import { ReadStateService } from '../../../../../../../services/read-state.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dm-list',
  imports: [CommonModule, ContactItem, RouterModule],
  templateUrl: './dm-list.html',
  styleUrl: './dm-list.scss',
})
export class DmList implements OnInit, OnDestroy, OnChanges {
  @Input() meUid: string | null = null;
  @Input() search: string = '';
  
  private sortSub?: Subscription;
  private totalUnreadSub?: Subscription;
  
  users: User[] = [];
  
  sortedUsers: User[] = [];
  dmsOpen = true;
  totalUnread = 0;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    public viewStateService: ViewStateService,
    private read: ReadStateService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.subscribeToUsers();
  }

  ngOnDestroy(): void {
    this.sortSub?.unsubscribe();
    this.totalUnreadSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['meUid']) {
      this.buildSortedUsers(this.users, this.meUid);
      this.buildTotalUnread(this.users, this.meUid);
    }
  }

  get visibleUsers(): User[] {
    const base = this.sortedUsers.length ? this.sortedUsers : this.users;

    if (!this.search) {
      return base.slice(0, Math.min(this.viewStateService.maxVisible, base.length));
    }

    const me = base[0] && this.meUid && base[0].uid === this.meUid ? base[0] : null;
    const others = me ? base.slice(1) : base;

    const filteredOthers = others.filter((u) => stringMatches(u.name, this.search));
    return me && stringMatches(me.name, this.search) ? [me, ...filteredOthers] : filteredOthers;
  }

  get hiddenCount(): number {
    if (this.search) return 0;
    const base = this.sortedUsers.length ? this.sortedUsers : this.users;
    return Math.max(base.length - this.viewStateService.maxVisible, 0);
  }

  private subscribeToUsers() {
    this.userService.users$().subscribe((users) => {
      this.users = users;
      this.buildSortedUsers(this.users, this.meUid);
      this.buildTotalUnread(this.users, this.meUid);
    });
  }

  public loadMore(): void {
    this.viewStateService.maxVisible = Math.min(
      this.viewStateService.maxVisible + this.viewStateService.pageSizeUsers,
      this.users.length
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

    const me = list.find((u) => (u.uid === meUid)) || null;
    const others = list.filter((u) => u.uid !== meUid);

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
    this.viewStateService.maxVisible = Math.min(
      this.viewStateService.maxVisible,
      this.sortedUsers.length
    );
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

  public calculateDmId(otherUser: User): string {
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

    this.viewStateService.currentChatId = uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;
    const docRef = doc(this.firestore, 'dms', this.viewStateService.currentChatId);

    await setDoc(docRef, { members: [uid1, uid2] }, { merge: true });
  }
}
