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
/**
 * Dialog / bottom-sheet component used after creating a channel.
 * Lets the user choose who should be added to the new channel.
 */
export class AddUsersToChannel implements OnInit {
  /** Selected option: 'all' users or 'specific' users only. */
  selectedOption: string = 'all';
  /** All users currently in the workspace (raw data). */
  users: any[] = [];
  /** Cached list of all users, used when adding everyone. */
  allUsers: any[] = [];
  /** Current text in the mention input field. */
  inputValue: string = '';
  /** Users that have been selected to join the channel. */
  selectedUsers: MentionUser[] = [];
  /** The currently logged-in user (always included by default). */
  currentUser: MentionUser | undefined;

  /**
   * Whether the mention dropdown should be shown.
   * True when the user has typed at least one character.
   */
  get showMention(): boolean {
    return this.inputValue.length > 0;
  }

  /** Current mention mode (here we only use 'users'). */
  mentionMode: 'users' | 'channels' = 'users';
  /** List of users that can be mentioned (excludes the current user). */
  mentionUsers: MentionUser[] = [];

  /**
   * Creates an instance of the AddUsersToChannel component.
   * @param userService Service that provides user data.
   * @param dialogRef Optional reference if opened as a dialog.
   * @param sheetRef Optional reference if opened as a bottom sheet.
   * @param dialogData Data passed when opened as a dialog (channel info).
   * @param sheetData Data passed when opened as a bottom sheet (channel info).
   */
  constructor(
    private userService: UserService,
    @Optional() public dialogRef: MatDialogRef<AddUsersToChannel>,
    @Optional() public sheetRef: MatBottomSheetRef<AddUsersToChannel>,
    @Optional()
    @Inject(MAT_DIALOG_DATA)
    public dialogData: { channelName: string; description: string },
    @Optional()
    @Inject(MAT_BOTTOM_SHEET_DATA)
    public sheetData: { channelName: string; description: string }
  ) {}

  /**
   * Returns the injected data, independent of whether it came from a dialog
   * or from a bottom sheet.
   */
  get data() {
    return this.dialogData ?? this.sheetData;
  }

  /**
   * Lifecycle hook that runs once after component creation.
   * - Loads the current user and selects them by default
   * - Loads all users and builds the list of mentionable users
   */
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

  /**
   * Confirms the selection.
   * Depending on the selected option, creates a channel:
   * - For specific users only
   * - Or for all users in the workspace
   */
  onConfirm() {
    if (this.selectedOption === 'specific') {
      this.createChannelWithSelectedUsers();
    } else {
      this.createChannelForAllUsers();
    }
  }

  /**
   * Closes the dialog or bottom sheet with an optional result.
   * @param result Data returned to the caller (channel + users).
   */
  public close(result?: any) {
    if (this.sheetRef) {
      this.sheetRef.dismiss(result);
    } else if (this.dialogRef) {
      this.dialogRef.close(result);
    }
  }

  /**
   * Creates a result object containing the channel info and only the
   * users picked by the creator, then closes the dialog/sheet.
   * The current user is always included in `selectedUsers`.
   */
  private createChannelWithSelectedUsers() {
    this.close({
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

  /**
   * Creates a result object containing the channel info and all users
   * in the workspace, then closes the dialog/sheet.
   */
  private createChannelForAllUsers() {
    this.close({
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

  /**
   * Adds a user to the list of selected users and clears the input field.
   * Usually called when the user picks someone from the mention list.
   * @param user The user to add to the selected list.
   */
  addUserToChosen(user: MentionUser) {
    this.selectedUsers.unshift(user);
    this.inputValue = '';
  }
}
