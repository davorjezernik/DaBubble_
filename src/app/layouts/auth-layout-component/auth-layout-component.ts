import { Component, OnInit } from '@angular/core';
import { DialogLoginComponent } from '../../dialogs/dialog.login-component/dialog.login-component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-auth-layout-component',
  imports: [],
  templateUrl: './auth-layout-component.html',
  styleUrl: './auth-layout-component.scss',
})
export class AuthLayoutComponent implements OnInit {
  constructor(public dialog: MatDialog) {}

  ngOnInit(): void {
    this.dialog.open(DialogLoginComponent, {
      disableClose: true,
      hasBackdrop: false,
    });
  }
}
