import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AddableUser {
  uid: string;
  name: string;
  avatar?: string;
  online?: boolean;
}

@Component({
  selector: 'app-dialog-icon-add-member-to-channel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialog-icon-add-member-to-channel.html',
  styleUrl: './dialog-icon-add-member-to-channel.scss',
})
export class DialogIconAddMemberToChannel {
  @Input() channelName = '';
  @Input() candidates: AddableUser[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<AddableUser[]>();

  query = '';
  filtered: AddableUser[] = [];
  selectedUsers: AddableUser[] = [];

  @ViewChild('userInput') userInput!: ElementRef<HTMLInputElement>;

  stop(e: MouseEvent) {
    e.stopPropagation();
  }
  onInput(val: string) {
    this.query = val;
    const q = val.trim().toLowerCase();

    if (!q) {
      this.filtered = [];
      return;
    }
    const already = new Set(this.selectedUsers.map((u) => u.uid));
    this.filtered = this.candidates
      .filter((u) => !already.has(u.uid))
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }

  selectCandidate(u: AddableUser) {
    if (!this.selectedUsers.find((x) => x.uid === u.uid)) {
      this.selectedUsers.push(u);
    }
    this.query = '';
    this.filtered = [];

    setTimeout(() => this.userInput?.nativeElement.focus(), 0);
  }

  removeChip(u: AddableUser, e?: MouseEvent) {
    e?.stopPropagation();
    this.selectedUsers = this.selectedUsers.filter((x) => x.uid !== u.uid);
  }

  submit() {
    if (this.selectedUsers.length > 0) {
      this.add.emit(this.selectedUsers);
      this.close.emit();
      return;
    }
    const text = this.query.trim();
    if (!text) return;

    this.add.emit([
      {
        uid: '',
        name: text,
        avatar: '',
        online: false,
      },
    ]);
    this.close.emit();
  }

  submitFromEnter() {
    this.submit();
  }
}
