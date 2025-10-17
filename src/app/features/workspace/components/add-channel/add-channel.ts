import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { Firestore } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../../../services/channel-service';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-add-chat',
  imports: [NgIf, FormsModule, MatFormFieldModule],
  templateUrl: './add-channel.html',
  styleUrl: './add-channel.scss',
})
export class AddChannel {
  isModalOpen = false;

  namingConflict = false;

  channelName: string = '';
  description: string = '';

  constructor(firestore: Firestore, private channelService: ChannelService) {}

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  async createChannel() {
    try {
      await this.doesChannelExists();
    } catch (error) {
      console.error('Error adding channel:', error);
    } finally {
      if (this.namingConflict) return;
      this.closeModal();
    }
  }

  async doesChannelExists() {
    const channels = await firstValueFrom(this.channelService.getChannels());
    const channelExists = channels.some((channel) => channel.name === this.channelName);
    if (channelExists) {
      this.namingConflict = true;
    }
  }
}
