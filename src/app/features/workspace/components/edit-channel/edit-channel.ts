import { Component } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-edit-channel',
  imports: [NgIf],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss'
})
export class EditChannel {
  isModalOpen = false;

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }
}
