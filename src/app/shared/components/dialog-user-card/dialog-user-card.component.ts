import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { User } from './../../../../models/user.class';

@Component({
  selector: 'app-dialog-user-card',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './dialog-user-card.component.html',
  styleUrl: './dialog-user-card.component.scss'
})
export class DialogUserCardComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { user: User },
    public dialogRef: MatDialogRef<DialogUserCardComponent>
  ) {}

  fallbackAvatar(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/img-profile/profile.png';
  }
}