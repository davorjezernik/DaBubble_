import { Component } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-add-chat',
  imports: [NgIf],
  templateUrl: './add-channel.html',
  styleUrl: './add-channel.scss'
})
export class AddChannel {
  isModalOpen = false;

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }
}
