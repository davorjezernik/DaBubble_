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
/**
 * Shows the list of direct message contacts (DMs).
 * Handles sorting, unread counts and basic search behaviour.
 */
export class DmList implements OnInit, OnDestroy, OnChanges {
  /** UID of the currently logged-in user. */
  @Input() meUid: string | null = null;
  /** Current search query string for filtering users by name. */
  @Input() search: string = '';

  private sortSub?: Subscription;
  private totalUnreadSub?: Subscription;

  users: User[] = [];

  /** Sorted list of users based on recent activity and unread counts. */
  sortedUsers: User[] = [];
  /** Whether the DMs section is expanded or collapsed. */
  dmsOpen = true;
  /** Total unread messages across all DMs. */
  totalUnread = 0;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    public viewStateService: ViewStateService,
    private read: ReadStateService,
    private userService: UserService
  ) {}

  /**
   * Lifecycle hook called after component creation.
   * Starts subscription to the users stream.
   */
  ngOnInit(): void {
    this.subscribeToUsers();
  }

  /**
   * Lifecycle hook called just before the component is destroyed.
   * Unsubscribes from all active subscriptions.
   */
  ngOnDestroy(): void {
    this.sortSub?.unsubscribe();
    this.totalUnreadSub?.unsubscribe();
  }

  /**
   * Reacts to changes on input properties.
   * Rebuilds sorting and unread count when `meUid` changes.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['meUid']) {
      this.buildSortedUsers(this.users, this.meUid);
      this.buildTotalUnread(this.users, this.meUid);
    }
  }

  /**
   * List of users visible in the UI, taking search and pagination into account.
   */
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

  /**
   * Number of hidden users below the "load more" threshold.
   */
  get hiddenCount(): number {
    if (this.search) return 0;
    const base = this.sortedUsers.length ? this.sortedUsers : this.users;
    return Math.max(base.length - this.viewStateService.maxVisible, 0);
  }

  /**
   * Subscribes to the user list and rebuilds sorting and unread counts
   * whenever the user list changes.
   */
  private subscribeToUsers() {
    this.userService.users$().subscribe((users) => {
      this.users = users;
      this.buildSortedUsers(this.users, this.meUid);
      this.buildTotalUnread(this.users, this.meUid);
    });
  }

  /**
   * Increases the number of visible users by one "page".
   * Reloads unread counts for newly visible items
   */
  public loadMore(): void {
    this.viewStateService.maxVisible = Math.min(
      this.viewStateService.maxVisible + this.viewStateService.pageSizeUsers,
      this.users.length
    );
    this.buildTotalUnread(this.users, this.meUid);
  }

  /**
   * Resets the total unread DM count back to zero.
   */
  private resetTotalUnread() {
    this.totalUnread = 0;
  }

  /**
   * Builds the total unread counter based on the current user list.
   * @param list All users available for DMs.
   * @param meUid UID of the current user.
   */
  private buildTotalUnread(list: User[], meUid: string | null) {
    this.totalUnreadSub?.unsubscribe();
    if (!meUid) return this.resetTotalUnread();
    this.processDmSubscription(list, meUid);
  }

  /**
   * Prepares the list used for unread subscriptions and skips the current user.
   * @param list All users available for DMs.
   * @param meUid UID of the current user.
   */
  private processDmSubscription(list: User[], meUid: string) {
    const others = list.filter((u) => u.uid !== meUid);

    if (!others.length) return this.resetTotalUnread();

    this.subscribeToDmUnreadCounts(others, meUid);
  }

  /**
   * Subscribes to unread-count streams for each DM and sums them up
   * into `totalUnread`.
   * Only subscribes to visible DMs
   * @param others Users that can be DM'ed (excluding the current user).
   * @param meUid UID of the current user.
   */
  private subscribeToDmUnreadCounts(others: User[], meUid: string) {
    const base = this.sortedUsers.length ? this.sortedUsers : others;
    const visibleOthers = base.slice(0, Math.min(this.viewStateService.maxVisible, base.length));
    const visibleNonMe = visibleOthers.filter((u) => u.uid !== meUid);
    const streams = visibleNonMe.map((u) => {
      const dmId = this.calculateDmId(u);
      return this.read.unreadDmCount$(dmId, meUid);
    });

    if (!streams.length) {
      this.totalUnread = 0;
      return;
    }
    this.totalUnreadSub = combineLatest(streams)
      .pipe(
        auditTime(500),
        map((arr) => arr.reduce((sum, n) => sum + (n || 0), 0))
      )
      .subscribe((sum) => (this.totalUnread = sum));
  }

  /**
   * Helper to set the sorted user list.
   * @param list New list of users.
   */
  private setSortedUsers(list: User[]) {
    this.sortedUsers = list;
  }

  /**
   * Initializes the sorted users array using the current user (if any).
   * @param me Currently logged-in user or null.
   */
  private computeSortedUsers(me: User | null) {
    this.sortedUsers = me ? [me] : [];
  }

  /**
   * Builds the sorted user list and starts subscriptions that
   * keep the list sorted by activity and unread state.
   * @param list Full user list.
   * @param meUid UID of the current user.
   */
  private buildSortedUsers(list: User[], meUid: string | null) {
    this.sortSub?.unsubscribe();

    if (!meUid) return this.setSortedUsers(list);

    const me = list.find((u) => u.uid === meUid) || null;
    const others = list.filter((u) => u.uid !== meUid);

    if (!others.length) return this.computeSortedUsers(me);

    this.subscribeToUserSort(others, me, meUid);
  }

  /**
   * Subscribes to metadata streams for DMs and updates sorting
   * whenever new metadata arrives.
   */
  private subscribeToUserSort(others: User[], me: User | null, meUid: string) {
    const metaStreams = this.createMetaStreams(others, meUid);

    this.sortSub = combineLatest(metaStreams)
      .pipe(auditTime(16))
      .subscribe((metaArr) => this.handleSortUpdate(metaArr, others, me));
  }

  /**
   * Applies a new sorted order based on DM metadata.
   */
  private handleSortUpdate(metaArr: any[], others: User[], me: User | null) {
    const metaMap = new Map(metaArr.map((x) => [x.uid, x.meta]));
    const sortedOthers = [...others].sort((a, b) => this.compareUsers(a, b, metaMap));

    this.sortedUsers = me ? [me, ...sortedOthers] : sortedOthers;
    this.viewStateService.maxVisible = Math.min(
      this.viewStateService.maxVisible,
      this.sortedUsers.length
    );
  }

  /**
   * Creates the observable streams that provide DM metadata
   * for each other user.
   */
  private createMetaStreams(others: User[], meUid: string) {
    return others.map((u) => {
      const dmId = this.calculateDmId(u);
      return this.read.dmMeta$(dmId, meUid).pipe(map((meta) => ({ uid: u.uid, meta })));
    });
  }

  /**
   * Compares two users based on unread messages, last message time
   * and name, to decide their order in the DM list.
   */
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

  /**
   * Compares by whether there are unread messages (unread > 0 comes first).
   */
  private compareByUnread(ma: any, mb: any): number {
    return (mb.unread > 0 ? 1 : 0) - (ma.unread > 0 ? 1 : 0);
  }

  /**
   * Compares by last message timestamp (more recent first).
   */
  private compareByTime(ma: any, mb: any): number {
    return mb.lastMessageAt - ma.lastMessageAt;
  }

  /**
   * Fallback comparison by user name (alphabetical, case-insensitive).
   */
  private compareByName(a: User, b: User): number {
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, {
      sensitivity: 'base',
    });
  }

  /**
   * Builds a unique DM ID for the current user and another user.
   * The ID is stable regardless of the order of the two UIDs.
   * @param otherUser The other user in the DM.
   * @returns The DM ID string, or empty string if `meUid` is missing.
   */
  public calculateDmId(otherUser: User): string {
    if (!this.meUid) return '';
    const uid1 = this.meUid;
    const uid2 = otherUser.uid;
    return uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;
  }

  /**
   * Ensures that a DM document exists between the current user
   * and another user, then navigates to that DM.
   * @param otherUser The other user to DM with.
   */
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
