import { Component } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-add-chat',
  imports: [NgIf],
  templateUrl: './add-chat.html',
  styleUrl: './add-chat.scss'
})
export class AddChat {
  isModalOpen = false;

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }
}
