import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { User } from './../../../../models/user.class';

@Component({
  selector: 'app-dialog-edit-user-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatInputModule, MatButtonModule],
  templateUrl: './dialog-edit-user-card.html',
  styleUrl: './dialog-edit-user-card.scss',
})
export class DialogEditUserCardComponent {
  nameCtrl = new FormControl<any>('');

  /**
   * Initialize the name control with the current user's name.
   */
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { user: User },
    private dialogRef: MatDialogRef<DialogEditUserCardComponent>
  ) {
    this.nameCtrl.setValue(data.user.name || '');
  }

  /** Close the dialog without returning a value. */
  close() {
    this.dialogRef.close();
  }

  /**
   * Trim and validate the input, then close dialog returning the new name.
   * Closes without value when the input is empty.
   */
  save() {
    if (this.data.user.email === 'guest@example.com') {
      this.dialogRef.close();
      return;
    }
    const newName = (this.nameCtrl.value ?? '').trim();
    
    if (!newName) {
      this.dialogRef.close();
      return;
    } 
    this.dialogRef.close(newName);
  }
}
