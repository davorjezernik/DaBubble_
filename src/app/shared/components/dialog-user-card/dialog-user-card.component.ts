import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MatDialogModule} from '@angular/material/dialog';

@Component({
  selector: 'app-dialog-user-card',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,  

  ],
  templateUrl: './dialog-user-card.component.html',
  styleUrl: './dialog-user-card.component.scss'
})
export class DialogUserCardComponent {

}
