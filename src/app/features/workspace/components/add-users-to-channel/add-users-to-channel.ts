import { DialogRef } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormField } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';

@Component({
  selector: 'app-add-users-to-channel',
  imports: [MatDialogModule, MatIconModule, MatRadioModule, MatButtonModule, FormsModule, MatFormField],
  templateUrl: './add-users-to-channel.html',
  styleUrl: './add-users-to-channel.scss',
})
export class AddUsersToChannel {

  users: any[] = [];

  constructor(public dialogRef: DialogRef<AddUsersToChannel>) {
  }

  onConfirm() {
    this.dialogRef.close();
  }
}
