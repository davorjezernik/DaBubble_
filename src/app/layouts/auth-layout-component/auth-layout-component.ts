import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DialogSigninComponent } from '../../features/authentication/components/dialog.signup-component/dialog.signup-component';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { DialogLoginComponent } from '../../features/authentication/components/dialog.login-component/dialog.login-component';

@Component({
  selector: 'app-auth-layout-component',
  imports: [RouterModule],
  templateUrl: './auth-layout-component.html',
  styleUrl: './auth-layout-component.scss',
})
export class AuthLayoutComponent implements OnInit, OnDestroy {
  constructor(public dialog: MatDialog, public router: Router) {}

  isLogin = true;

  isAuth = signal(true);

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.urlAfterRedirects === '/') {
          this.isAuth.set(true);
        } else {
          this.isAuth.set(false);
        }
      });

    this.dialog.open(DialogLoginComponent, {
      disableClose: true,
      hasBackdrop: false,
    });
  }

  openDialog(): void {
    this.isLogin = false;
    this.dialog.closeAll();
    const dialogRef = this.dialog.open(DialogSigninComponent, {
      disableClose: true,
      hasBackdrop: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      console.log('The dialog was closed');
    });
  }

  ngOnDestroy(): void {
    this.dialog.closeAll();
  }
}
