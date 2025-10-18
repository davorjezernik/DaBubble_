import { DialogRef } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';

@Component({
  selector: 'app-add-users-to-channel',
  imports: [MatDialogModule, MatIconModule, MatRadioModule],
  templateUrl: './add-users-to-channel.html',
  styleUrl: './add-users-to-channel.scss'
})
export class AddUsersToChannel {

  constructor(public dialogRef: DialogRef<AddUsersToChannel>) { }
}
