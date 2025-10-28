import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../services/user.service';

export interface MentionUser {
  uid: string;
  name: string;
  avatar: string;
  online?: boolean;
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
  styleUrls: ['./mention-list.component.scss'],
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

  private userService = inject(UserService);
  currentUserId: string | null = null;

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
    return this._users.filter((u) => u.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
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
}
