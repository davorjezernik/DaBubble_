import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-menu-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './user-menu-dialog.component.html',
  styleUrls: ['./user-menu-dialog.component.scss']
})
export class UserMenuDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private ref: MatDialogRef<UserMenuDialogComponent>
  ) {}
  close(action: 'profile'|'logout') { this.ref.close(action); }
}
