import { Component, Input } from '@angular/core';
import { MentionUser } from '../mention-list.component/mention-list.component';

@Component({
  selector: 'app-contact-chip',
  imports: [],
  templateUrl: './contact-chip.html',
  styleUrl: './contact-chip.scss',
})
export class ContactChip {
  @Input() userData!: MentionUser;
  @Input() usersSelected!: MentionUser[];
  @Input() isRemovable: boolean = true;

  removeAddedUser(uid: string) {
    if (this.usersSelected && this.isRemovable) {
      const index = this.usersSelected.findIndex((user) => user.uid === uid);
      if (index !== -1) {
        this.usersSelected.splice(index, 1);
      }
    }
  }
}
