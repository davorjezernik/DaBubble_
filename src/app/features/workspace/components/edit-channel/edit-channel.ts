import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../../../services/channel-service';

@Component({
  selector: 'app-edit-channel',
  standalone: true,
  imports: [CommonModule, MatDialogModule, FormsModule],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss',
})
export class EditChannel implements OnInit {
  hasChanges = false;
  isEditingName = false;
  isEditingDescription = false;
  editedName = '';
  editedDescription = '';
  
  constructor(
    public dialogRef: MatDialogRef<EditChannel>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private channelService: ChannelService
  ) {}

  ngOnInit() {
    this.editedName = this.data?.channel?.name || '';
    this.editedDescription = this.data?.channel?.description || '';
  }

  closeModal() {
    this.dialogRef.close(this.hasChanges);
  }

  startEditingName() {
    this.isEditingName = true;
    this.editedName = this.data?.channel?.name || '';
  }

  startEditingDescription() {
    this.isEditingDescription = true;
    this.editedDescription = this.data?.channel?.description || '';
  }

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

  private async updateNameIfChanged() {
    if (this.editedName === this.data.channel.name) return;
    await this.updateChannel({ name: this.editedName });
    this.data.channel.name = this.editedName;
  }

  private async updateDescriptionIfChanged() {
    if (this.editedDescription === this.data.channel.description) return;
    await this.updateChannel({ description: this.editedDescription });
    this.data.channel.description = this.editedDescription;
  }

  private async updateChannel(updateData: Partial<{ name: string; description: string }>) {
    await this.channelService.updateChannel(this.data.channel.id, updateData);
    this.hasChanges = true;
  }

  private handleUpdateError(err: unknown) {
    console.error('Error updating channel:', err);
  }

  private resetEditingState() {
    this.isEditingName = false;
    this.isEditingDescription = false;
  }


}
