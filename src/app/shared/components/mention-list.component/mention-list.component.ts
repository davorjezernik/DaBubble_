import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../services/user.service';

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
export class MentionListComponent {
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
  currentUserId: string | null = null;

  @Input() allowRawEmail = true;
  @Input() showEmail = false;

  private _users: MentionUser[] = [];
  get users(): MentionUser[] {
    this.sanitizeSearchTerm();
    const filteredUsers = this.filterByInputValue();
    const alreadySelectedUsers = this.filterAlreadyChosen(filteredUsers);
    if (!this.currentUserId) return alreadySelectedUsers;
    return this.returnSortedUsers(alreadySelectedUsers);
  }

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

  private filterByInputValue() {
    const q = (this.searchTerm || '').toLowerCase();
    return this._users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }

  private filterAlreadyChosen(filteredUsers: MentionUser[]) {
    return filteredUsers.filter(
      (u) => u.uid !== this.allSelectedUsers.find((su) => su.uid === u.uid)?.uid
    );
  }

  returnSortedUsers(filteredUsers: MentionUser[]) {
    return [...filteredUsers].sort((a, b) =>
      a.uid === this.currentUserId ? -1 : b.uid === this.currentUserId ? 1 : 0
    );
  }

  @Input() set users(value: MentionUser[]) {
    this._users = value ?? [];
  }

  constructor() {
    this.userService.currentUser$().subscribe((u) => {
      this.currentUserId = u?.uid ?? null;
    });
  }

  private isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  }

  get noUserEmailOption(): string | null {
    const q = (this.searchTerm || '').trim();
    if (!this.allowRawEmail || !this.isValidEmail(q)) return null;
    const exists = this._users.some((u) => (u.email || '').toLowerCase() === q.toLowerCase());
    return exists ? null : q;
  }

  onPickUser(u: MentionUser) {
    this.pick.emit(`@${u.name} `);
  }

  onPickChannel(c: MentionChannel) {
    this.pick.emit(`#${c.name} `);
    this.channelSelected.emit(c);
  }

  onUserSelected(u: MentionUser) {
    this.userSelected.emit(u);
  }

  get channelsView(): MentionChannel[] {
    const qRaw = (this.searchTerm || '').trim();
    const q = (qRaw.startsWith('#') ? qRaw.slice(1) : qRaw).toLowerCase();
    if (!q) return this.channels ?? [];
    return (this.channels ?? []).filter((c) => (c.name || '').toLowerCase().includes(q));
  }
}
