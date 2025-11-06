import { inject, Injectable } from '@angular/core';
import { UserMenuDialogComponent } from '../app/shared/components/user-menu-dialog.component/user-menu-dialog.component';
import { DialogUserCardComponent } from '../app/shared/components/dialog-user-card/dialog-user-card.component';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Auth, signOut } from '@angular/fire/auth';
import { User } from '../models/user.class';
import { Observable, take } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserMenuService {
    private auth = inject(Auth);
    private router = inject(Router);
    private userService = inject(UserService);
    private dialog = inject(MatDialog);
    private bottomSheet = inject(MatBottomSheet);

  // menü für oben und ab 400 px unten //
  openUserMenu(evt: MouseEvent, user$: Observable<User | null>) {
    const trigger = evt.currentTarget as HTMLElement;
    const avatar = (trigger.querySelector('.avatar-wrap') as HTMLElement) ?? trigger;
    const r = avatar.getBoundingClientRect();

    const GAP = 8;
    const MARGIN = 16;
    const MENU_W = window.innerWidth <= 880 ? 350 : 300;

    // wenn kleiner als 400px //
    if (window.innerWidth <= 400) {
      const ref = this.bottomSheet.open(UserMenuDialogComponent, {
        data: {},
        panelClass: 'user-menu-bottom',
      });
      ref
        .afterDismissed()
        .pipe(take(1))
        .subscribe((action) => {
          if (action === 'profile') this.openProfil(user$);
          if (action === 'logout') this.logout();
        });
      return;
    }

    // normales Dialog-Menü //
    let left = r.right - MENU_W;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - MENU_W - MARGIN));
    const top = r.bottom + GAP;

    const ref = this.dialog.open(UserMenuDialogComponent, {
      data: {},
      panelClass: 'user-menu-dialog',
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: true,
      position: { top: `${top}px`, left: `${left}px` },
    });

    ref
      .afterClosed()
      .pipe(take(1))
      .subscribe((action) => {
        if (action === 'profile') this.openProfil(user$);
        if (action === 'logout') this.logout();
      });
  }

  openProfil(user$: Observable<User | null>) {
    user$.pipe(take(1)).subscribe((user) => {
      if (!user) return;
      this.dialog.open(DialogUserCardComponent, {
        data: { user },
        panelClass: 'user-card-dialog',
        width: '500px',
        height: '705px',
        maxWidth: 'none',
        maxHeight: 'none',
        autoFocus: false,
        restoreFocus: true,
      });
    });
  }

  async logout() {
    await this.userService.markOnline(false);
    await signOut(this.auth);
    this.router.navigateByUrl('/');
  }

    // Avatar-Fallback //
  fallbackAvatar(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/img-profile/profile.png';
  }
}
