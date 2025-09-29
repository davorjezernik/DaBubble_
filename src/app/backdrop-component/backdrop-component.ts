import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';

@Component({
  selector: 'app-backdrop-component',
  imports: [CommonModule,],
  templateUrl: './backdrop-component.html',
  styleUrls: ['./backdrop-component.scss'],
})
export class BackdropComponent {
  readonly dialog = inject(MatDialog);

  openDialog() {
    const dialogRef = this.dialog.open(DialogUserCardComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }
}
