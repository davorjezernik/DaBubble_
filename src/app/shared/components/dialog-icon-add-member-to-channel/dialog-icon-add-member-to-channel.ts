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
  /** Stop event propagation from inner controls. */
  stop(e: MouseEvent) {
    e.stopPropagation();
  }

  /**
   * Update query and filtered suggestions based on input value.
   * @param val Current input value
   */
  onInput(val: string) {
    this.query = val;
    const q = val.trim().toLowerCase();

    if (!q) return this.clearFilteredUsers();

    this.showFilteredUsers(q);
  }

  /**
   * Build the filtered suggestions list excluding already selected users.
   * @param q Lowercased query string
   */
  private showFilteredUsers(q: string) {
    const already = new Set(this.selectedUsers.map((u) => u.uid));
    this.filtered = this.candidates
      .filter((u) => !already.has(u.uid))
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }

  /** Reset filtered suggestions to empty. */
  private clearFilteredUsers() {
    this.filtered = [];
  }

  /**
   * Add a candidate to the selection and refocus the input.
   */
  selectCandidate(u: AddableUser) {
    if (!this.selectedUsers.find((x) => x.uid === u.uid)) {
      this.selectedUsers.push(u);
    }
    this.query = '';
    this.filtered = [];

    setTimeout(() => this.userInput?.nativeElement.focus(), 0);
  }

  /**
   * Remove a selected user chip.
   * @param u User to remove
   * @param e Optional event to stop propagation
   */
  removeChip(u: AddableUser, e?: MouseEvent) {
    e?.stopPropagation();
    this.selectedUsers = this.selectedUsers.filter((x) => x.uid !== u.uid);
  }

  /** Emit selected users and close when selection is non-empty. */
  submit() {
    if (this.selectedUsers.length < 1) return;
    this.add.emit(this.selectedUsers);
    this.close.emit();
  }

  /** Delegate Enter key submission to the standard submit flow. */
  submitFromEnter() {
    this.submit();
  }
}
