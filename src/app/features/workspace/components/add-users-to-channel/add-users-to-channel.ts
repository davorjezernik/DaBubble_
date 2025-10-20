import { DialogRef } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

@Component({
  selector: 'app-add-users-to-channel',
  imports: [MatDialogModule, MatIconModule, MatRadioModule, MatButtonModule, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './add-users-to-channel.html',
  styleUrls: ['./add-users-to-channel.scss', '../../../../shared/styles/form-field-styles.scss'],
})
export class AddUsersToChannel {

  selectedOption: string = 'all';
  users: any[] = [];

  constructor(public dialogRef: DialogRef<AddUsersToChannel>) {
  }

  onConfirm() {
    this.dialogRef.close();
  }
}
