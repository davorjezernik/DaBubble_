import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../services/user.service';
import { Subscription } from 'rxjs';

export interface MentionUser {
  uid: string;
  name: string;
  avatar: string;
  online?: boolean;
  email?: string;
}

export interface MentionChannel {
  id: string;
  name: string;
}

@Component({
  selector: 'app-mention-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mention-list.component.html',
  styleUrls: ['./mention-list.component.scss', './mention-list.component.responsiv..scss'],
})
export class MentionListComponent implements OnDestroy, OnInit {
  @Input() mode: 'users' | 'channels' = 'users';
  @Input() channels: MentionChannel[] = [];
  @Input() visible = false;
  @Output() pick = new EventEmitter<string>();
  @Input() searchTerm: string = '';
  @Output() userSelected = new EventEmitter<MentionUser>();
  @Input() allSelectedUsers: MentionUser[] = [];
  @Output() channelSelected = new EventEmitter<MentionChannel>();
  @Output() emailSelected = new EventEmitter<string>();

  private userService = inject(UserService);

  currentUserSub?: Subscription;
  currentUserId: string | null = null;

  @Input() allowRawEmail = true;
  @Input() showEmail = false;

  ngOnInit(): void {}

  /** Clean up current user subscription. */
  ngOnDestroy(): void {
    this.currentUserSub?.unsubscribe();
  }

  private _users: MentionUser[] = [];
  /**
   * Visible users computed from the backing list, search term, and selected users.
   * Current user is prioritized to the top when present.
   */
  get users(): MentionUser[] {
    this.sanitizeSearchTerm();
    const filteredUsers = this.filterByInputValue();
    const alreadySelectedUsers = this.filterAlreadyChosen(filteredUsers);
    if (!this.currentUserId) return alreadySelectedUsers;
    return this.returnSortedUsers(alreadySelectedUsers);
  }

  /** Normalize search term: trim and remove leading '@' or '#' mention prefixes. */
  private sanitizeSearchTerm() {
    if (this.searchTerm) {
      const trimmed = (this.searchTerm = this.searchTerm.trim());
      const isMention = trimmed.startsWith('@');
      const isChannel = trimmed.startsWith('#');
      if (isMention || isChannel) {
        this.searchTerm = trimmed.substring(1);
      }
    }
  }

  /** Filter backing users by case-insensitive name or email match against `searchTerm`. */
  private filterByInputValue() {
    const q = (this.searchTerm || '').toLowerCase();
    return this._users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }

  /** Exclude users that are already selected from the filtered result. */
  private filterAlreadyChosen(filteredUsers: MentionUser[]) {
    return filteredUsers.filter(
      (u) => u.uid !== this.allSelectedUsers.find((su) => su.uid === u.uid)?.uid
    );
  }

  /** Sort users so that the current user (if present) appears first. */
  returnSortedUsers(filteredUsers: MentionUser[]) {
    return [...filteredUsers].sort((a, b) =>
      a.uid === this.currentUserId ? -1 : b.uid === this.currentUserId ? 1 : 0
    );
  }

  @Input() set users(value: MentionUser[]) {
    this._users = value ?? [];
  }

  /** Subscribe to current user to prioritize self in lists. */
  constructor() {
    this.currentUserSub?.unsubscribe();
    this.currentUserSub = this.userService.currentUser$().subscribe((u) => {
      this.currentUserId = u?.uid ?? null;
    });
  }

  /** Basic email format validation. */
  private isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  }

  /**
   * Provide a raw email option when allowed and not already present in users.
   */
  get noUserEmailOption(): string | null {
    const q = (this.searchTerm || '').trim();
    if (!this.allowRawEmail || !this.isValidEmail(q)) return null;
    const exists = this._users.some((u) => (u.email || '').toLowerCase() === q.toLowerCase());
    return exists ? null : q;
  }

  /** Emit mention token for a picked user. */
  onPickUser(u: MentionUser) {
    this.pick.emit(`@${u.name} `);
  }

  /** Emit mention token for a picked channel and propagate selection. */
  onPickChannel(c: MentionChannel) {
    this.pick.emit(`#${c.name} `);
    this.channelSelected.emit(c);
  }

  /** Emit full user selection for multi-select contexts. */
  onUserSelected(u: MentionUser) {
    this.userSelected.emit(u);
  }

  /** Channels view filtered by the current search term (supports '#' prefix). */
  get channelsView(): MentionChannel[] {
    const qRaw = (this.searchTerm || '').trim();
    const q = (qRaw.startsWith('#') ? qRaw.slice(1) : qRaw).toLowerCase();
    if (!q) return this.channels ?? [];
    return (this.channels ?? []).filter((c) => (c.name || '').toLowerCase().includes(q));
  }
}
