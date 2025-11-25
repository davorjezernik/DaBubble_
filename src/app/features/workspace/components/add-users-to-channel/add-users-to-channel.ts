import { Component, Inject, OnInit, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import {
  MentionListComponent,
  MentionUser,
} from '../../../../shared/components/mention-list.component/mention-list.component';
import { UserService } from '../../../../../services/user.service';
import { firstValueFrom } from 'rxjs';
import { ContactChip } from '../../../../shared/components/contact-chip/contact-chip';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';

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
    ContactChip,
  ],
  templateUrl: './add-users-to-channel.html',
  styleUrls: [
    './add-users-to-channel.scss',
    './add-users-to-channel.responsive.scss',
    '../../../../shared/styles/form-field-styles.scss',
  ],
})
export class AddUsersToChannel implements OnInit {
  selectedOption: string = 'all';
  users: any[] = [];
  allUsers: any[] = [];
  inputValue: string = '';
  selectedUsers: MentionUser[] = [];
  currentUser: MentionUser | undefined;

  get showMention(): boolean {
    return this.inputValue.length > 0;
  }

  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];

  constructor(
    private userService: UserService,
    @Optional() public dialogRef: MatDialogRef<AddUsersToChannel>,
    @Optional() public sheetRef: MatBottomSheetRef<AddUsersToChannel>,
    @Optional() @Inject(MAT_DIALOG_DATA) public dialogData: { channelName: string; description: string },
    @Optional() @Inject(MAT_BOTTOM_SHEET_DATA) public sheetData: { channelName: string; description: string }
  ) {}

    get data() {
    return this.dialogData ?? this.sheetData;
  }

  async ngOnInit() {
    const currentUserData = await firstValueFrom(this.userService.currentUser$());
    if (currentUserData) {
      this.currentUser = {
        uid: currentUserData.uid,
        name: currentUserData.name,
        avatar: currentUserData.avatar,
        online: currentUserData.online,
      };
      this.selectedUsers.push(this.currentUser);
    }

    const users = await firstValueFrom(this.userService.users$());
    this.allUsers = users;
    this.mentionUsers = users
      .map((u) => ({
        uid: u.uid,
        name: u.name,
        avatar: u.avatar,
        online: u.online,
      }))
      .filter((u) => u.uid !== this.currentUser?.uid);
  }

  onConfirm() {
    if (this.selectedOption === 'specific') {
      this.createChannelWithSelectedUsers();
    } else {
      this.createChannelForAllUsers();
    }
  }

    public closeDialog(result?: any) {
    if (this.sheetRef) {
      this.sheetRef.dismiss(result);
    } else if (this.dialogRef) {
      this.dialogRef.close(result);
    }
  }

  private createChannelWithSelectedUsers() {
    this.closeDialog({
      channel: {
        channelName: this.data.channelName.trim(),
        description: this.data.description.trim(),
      },
      users: this.selectedUsers.map((user) => ({
        uid: user.uid,
        displayName: user.name,
      })),
    });
  }

  private createChannelForAllUsers() {
    this.closeDialog({
      channel: {
        channelName: this.data.channelName.trim(),
        description: this.data.description.trim(),
      },
      users: this.allUsers.map((user) => ({
        uid: user.uid,
        displayName: user.name,
      })),
    });
  }

  addUserToChosen(user: MentionUser) {
    this.selectedUsers.unshift(user);
    this.inputValue = '';
  }
}
