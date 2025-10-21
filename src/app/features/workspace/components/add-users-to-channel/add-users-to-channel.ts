import { DialogRef } from '@angular/cdk/dialog';
import { Component, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import {
  MentionListComponent,
  MentionUser,
} from '../../../../shared/components/mention-list.component/mention-list.component';
import { UserService } from '../../../../../services/user.service';
import { user } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-add-users-to-channel',
  imports: [
    MatDialogModule,
    MatIconModule,
    MatRadioModule,
    MatButtonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MentionListComponent,
  ],
  templateUrl: './add-users-to-channel.html',
  styleUrls: ['./add-users-to-channel.scss', '../../../../shared/styles/form-field-styles.scss'],
})
export class AddUsersToChannel implements OnInit {
  selectedOption: string = 'all';
  users: any[] = [];
  inputValue: string = '';

  get showMention(): boolean {
    return this.inputValue.length > 0;
  }

  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];

  constructor(public dialogRef: DialogRef<AddUsersToChannel>, private userService: UserService) {}

  async ngOnInit() {
    const users = await firstValueFrom(this.userService.users$());
    this.mentionUsers = users.map((u) => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
    }));
  }

  onConfirm() {
    this.dialogRef.close();
  }
}
