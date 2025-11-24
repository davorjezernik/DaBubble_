import { Component, Optional, ViewChild } from '@angular/core';
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
export class AddChannel {
  isModalOpen = false;

  namingConflict = false;

  channelName: string = '';
  description: string = '';

  @ViewChild('channelNameInput') channelNameInput?: NgModel;

  constructor(
    private channelService: ChannelService,
    @Optional() public dialogRef: MatDialogRef<AddChannel>,
    @Optional() public sheetRef: MatBottomSheetRef<AddChannel>
  ) {}

  closeDialog(result?: any) {
    if (this.sheetRef) {
      this.sheetRef.dismiss(result);
    } else if (this.dialogRef) {
      this.dialogRef.close(result);
    }
  }

  async onConfirm() {
    this.channelName = this.channelName.trim();
    this.description = this.description.trim();
    const channelExists = await this.doesChannelExists();

    if (channelExists) {
      this.channelNameInput?.control.setErrors({ namingConflict: true });
      return;
    }

    if (!this.channelNameInput?.invalid) {
      this.closeDialog({
        channelName: this.channelName,
        description: this.description,
      });
    }
  }

  async doesChannelExists(): Promise<boolean> {
    const channels = await firstValueFrom(this.channelService.getChannels());
    return channels.some((channel) => channel.name === this.channelName);
  }
}
