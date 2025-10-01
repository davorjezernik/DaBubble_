import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-dialog.user-card-guest',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
  ],
  templateUrl: './dialog.user-card-guest.component.html',
  styleUrl: './dialog.user-card-guest.component.scss'
})
export class DialogUserCardGuestComponent {

}
