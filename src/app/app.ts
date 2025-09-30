import { Component, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DialogSigninComponent } from './dialogs/dialog.signin-component/dialog.signin-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, MatIconModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('dabubble');

  isAuth: boolean = true;

  constructor(public dialog: MatDialog, public router: Router) {}

  isLogin: boolean = true;

  openDialog(): void {
    const dialogRef = this.dialog.open(DialogSigninComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log('The dialog was closed');
    });
  }
}
