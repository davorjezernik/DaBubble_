import { Component, Optional, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatBottomSheetModule, MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';

@Component({
  selector: 'app-user-menu-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatBottomSheetModule],
  templateUrl: './user-menu-dialog.component.html',
  styleUrls: ['./user-menu-dialog.component.scss']
})
export class UserMenuDialogComponent {
  constructor(
    @Optional() private dialogRef: MatDialogRef<UserMenuDialogComponent>,
    @Optional() private sheetRef: MatBottomSheetRef<UserMenuDialogComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public dialogData: any,
    @Optional() @Inject(MAT_BOTTOM_SHEET_DATA) public sheetData: any,
  ) {}

  get data() { return this.dialogData ?? this.sheetData; }

  close(action: 'profile'|'logout') {
    this.dialogRef?.close(action); 
    this.sheetRef?.dismiss(action);    
  }
}