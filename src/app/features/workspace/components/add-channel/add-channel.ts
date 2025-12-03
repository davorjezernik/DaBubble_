import { Component, ElementRef, Optional, ViewChild } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { ChannelService } from '../../../../../services/channel-service';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheetModule, MatBottomSheetRef } from '@angular/material/bottom-sheet';

@Component({
  selector: 'app-add-chat',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatDialogModule,
    MatBottomSheetModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './add-channel.html',
  styleUrls: [
    './add-channel.scss',
    './add-channel.responsive.scss',
    '../../../../shared/styles/form-field-styles.scss',
  ],
})
/**
 * Dialog / bottom-sheet component to create a new channel.
 * Handles channel name + description and basic validation.
 */
export class AddChannel {
  /** Flag to track if the modal is open (used by template). */
  isModalOpen = false;

  /** True if a channel with the same name already exists. */
  namingConflict = false;

  /** Name of the new channel entered by the user. */
  channelName: string = '';
  /** Optional description of the new channel. */
  description: string = '';

  /** Template reference to the channel name input for validation. */
  @ViewChild('channelNameInput') channelNameInput?: NgModel;
  /** Container that will be scrolled after a valid name is entered. */
  @ViewChild('scrollContainer') scrollContainer?: ElementRef;

  /**
   * Creates an instance of the AddChannel component.
   * @param channelService Service used to load existing channels.
   * @param dialogRef Optional reference if opened as a dialog.
   * @param sheetRef Optional reference if opened as a bottom sheet.
   */
  constructor(
    private channelService: ChannelService,
    @Optional() public dialogRef: MatDialogRef<AddChannel>,
    @Optional() public sheetRef: MatBottomSheetRef<AddChannel>
  ) {}

  /**
   * Closes the dialog or bottom sheet with an optional result payload.
   * @param result Data returned to the caller (e.g. channel info).
   */
  close(result?: any) {
    if (this.sheetRef) {
      this.sheetRef.dismiss(result);
    } else if (this.dialogRef) {
      this.dialogRef.close(result);
    }
  }

  /**
   * Confirms the creation of a channel if validation passes.
   * - Trims user input
   * - Checks for name collisions
   * - Closes with channel data when valid
   */
  async onConfirm() {
    this.channelName = this.channelName.trim();
    this.description = this.description.trim();
    const channelExists = await this.doesChannelExists();

    if (channelExists) {
      this.channelNameInput?.control.setErrors({ namingConflict: true });
      return;
    }

    if (!this.channelNameInput?.invalid) {
      this.close({
        channelName: this.channelName,
        description: this.description,
      });
    }
  }

  /**
   * Checks if a channel with the same name already exists.
   * @returns Promise that resolves to true if a matching channel is found.
   */
  async doesChannelExists(): Promise<boolean> {
    const channels = await firstValueFrom(this.channelService.getChannels());
    return channels.some((channel) => channel.name === this.channelName);
  }

  /**
   * Called when the channel name input loses focus.
   * If the name is valid, scrolls the container to reveal the rest of the form.
   * @param input The Angular form control for the channel name.
   */
  public onNameBlur(input: NgModel) {
    if (input.valid && this.scrollContainer) {
      const element = this.scrollContainer.nativeElement;

      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth',
      });
    }
  }
}
