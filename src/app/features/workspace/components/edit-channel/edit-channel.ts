import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChannelService } from '../../../../../services/channel-service';
import { UserService } from '../../../../../services/user.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-channel',
  standalone: true,
  imports: [CommonModule, MatDialogModule, FormsModule, MatSnackBarModule],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss',
})
export class EditChannel implements OnInit {
  hasChanges = false;
  isEditingName = false;
  isEditingDescription = false;
  editedName = '';
  editedDescription = '';

  /**
   * Initializes the component with dependency injection.
   * @param dialogRef Reference to the dialog instance.
   * @param data Data injected into the dialog, including channel information.
   * @param channelService Service for channel-related operations.
   * @param snackBar Service for displaying snack bar notifications.
   * @param userService Service for user-related data.
   */
  constructor(
    public dialogRef: MatDialogRef<EditChannel>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private channelService: ChannelService,
    private snackBar: MatSnackBar,
    private userService: UserService
  ) {}

  /** Initializes component state with the current channel's name and description. */
  ngOnInit() {
    this.editedName = this.data?.channel?.name || '';
    this.editedDescription = this.data?.channel?.description || '';
  }

  /** Handles the action of a user leaving the current channel. */
  public leaveChannel() {
    this.removeUserFromChannelMembers();
    this.closeModal();
  }

  /** Closes the dialog and returns whether any changes were made. */
  public closeModal() {
    this.dialogRef.close(this.hasChanges);
  }

  /** Activates the editing mode for the channel name. */
  startEditingName() {
    this.isEditingName = true;
    this.editedName = this.data?.channel?.name || '';
  }

  /** Activates the editing mode for the channel description. */
  startEditingDescription() {
    this.isEditingDescription = true;
    this.editedDescription = this.data?.channel?.description || '';
  }

  /**
   * Saves the changes for a specified field ('name' or 'description').
   * @param field The field to save.
   */
  async saveChanges(field: 'name' | 'description') {
    if (!this.data?.channel?.id) return;
    try {
      if (field === 'name') {
        await this.updateNameIfChanged();
      } else if (field === 'description') {
        await this.updateDescriptionIfChanged();
      }
    } catch (err) {
      this.handleUpdateError(err);
    } finally {
      this.resetEditingState();
    }
  }

  /** Updates the channel name if it has been changed and is valid. */
  private async updateNameIfChanged() {
    const newName = (this.editedName || '').trim();
    if (newName === this.data.channel.name) return;
    if (newName.toLowerCase() === 'everyone') {
      this.snackBar.open('Diesen Namen kannst du nicht wählen.', 'OK', { duration: 4000 });
      return;
    }
    await this.updateChannel({ name: newName });
    this.data.channel.name = newName;
  }

  /** Updates the channel description if it has been changed. */
  private async updateDescriptionIfChanged() {
    if (this.editedDescription === this.data.channel.description) return;
    await this.updateChannel({ description: this.editedDescription });
    this.data.channel.description = this.editedDescription;
  }

  /**
   * Sends an update request to the ChannelService.
   * @param updateData An object containing the fields to update.
   */
  private async updateChannel(updateData: Partial<{ name: string; description: string }>) {
    await this.channelService.updateChannel(this.data.channel.id, updateData);
    this.hasChanges = true;
  }

  /**
   * Logs errors that occur during a channel update.
   * @param err The error object.
   */
  private handleUpdateError(err: unknown) {
    console.error('Error updating channel:', err);
  }

  /** Resets the editing state for both name and description fields. */
  private resetEditingState() {
    this.isEditingName = false;
    this.isEditingDescription = false;
  }

  /** Removes the current user from the channel's member list and redirects. */
  private async removeUserFromChannelMembers() {
    const currentUser = await firstValueFrom(this.userService.currentUser$());
    const currentUserId = currentUser?.uid;
    if (!currentUserId || !this.data?.channel?.id) return;
    const channelId = this.data.channel.id;
    await this.channelService.leaveChannel(channelId, currentUserId);
    await this.channelService.redirectToBasicChannel();
  }
}
