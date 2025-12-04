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

  /**
   * Opens the user menu.
   * @param evt The mouse event.
   * @param user$ The user observable.
   */
  openUserMenu(evt: MouseEvent, user$: Observable<User | null>) {
    const r = this.getAvatarRect(evt);
    const { GAP, MARGIN, MENU_W } = this.getMenuLayoutConstants();

    if (window.innerWidth <= 400) {
      const ref = this.openUserMenuMobileDialog();
      this.handleUserMenuAfterDismissed(ref, user$);
      return;
    }

    const { top, left } = this.computeMenuPosition(r, MENU_W, MARGIN, GAP);
    const ref = this.openUserMenuDialog(top, left);
    this.handleUserMenuAfterClosed(ref, user$);
  }

  /**
   * Handles the user menu after it is dismissed (mobile).
   * @param ref The bottom sheet reference.
   * @param user$ The user observable.
   */
  private handleUserMenuAfterDismissed(ref: any, user$: Observable<User | null>) {
    ref
      .afterDismissed()
      .pipe(take(1))
      .subscribe((action: any) => {
        if (action === 'profile') this.openProfil(user$);
        if (action === 'logout') this.logout();
      });
  }

  /**
   * Opens the user menu dialog for mobile.
   * @returns The bottom sheet reference.
   */
  private openUserMenuMobileDialog() {
    return this.bottomSheet.open(UserMenuDialogComponent, {
      data: {},
      panelClass: 'user-menu-bottom',
    });
  }

  /**
   * Computes the menu position.
   * @param r The avatar rectangle.
   * @param MENU_W The menu width.
   * @param MARGIN The margin.
   * @param GAP The gap.
   * @returns The top and left position.
   */
  private computeMenuPosition(r: DOMRect, MENU_W: number, MARGIN: number, GAP: number) {
    let left = r.right - MENU_W;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - MENU_W - MARGIN));
    const top = r.bottom + GAP;
    return { top, left };
  }

  /**
   * Opens the user menu dialog.
   * @param top The top position.
   * @param left The left position.
   * @returns The dialog reference.
   */
  private openUserMenuDialog(top: number, left: number) {
    return this.dialog.open(UserMenuDialogComponent, {
      data: {},
      panelClass: 'user-menu-dialog',
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: true,
      position: { top: `${top}px`, left: `${left}px` },
    });
  }

  /**
   * Handles the user menu after it is closed.
   * @param ref The dialog reference.
   * @param user$ The user observable.
   */
  private handleUserMenuAfterClosed(ref: any, user$: Observable<User | null>) {
    ref
      .afterClosed()
      .pipe(take(1))
      .subscribe((action: any) => {
        if (action === 'profile') this.openProfil(user$);
        if (action === 'logout') this.logout();
      });
  }

  /**
   * Gets the menu layout constants.
   * @returns The layout constants.
   */
  private getMenuLayoutConstants() {
    const GAP = 8;
    const MARGIN = 16;
    const MENU_W = window.innerWidth <= 880 ? 350 : 300;
    return { GAP, MARGIN, MENU_W };
  }

  /**
   * Gets the avatar rectangle from the event.
   * @param evt The mouse event.
   * @returns The avatar rectangle.
   */
  private getAvatarRect(evt: MouseEvent): DOMRect {
    const trigger = evt.currentTarget as HTMLElement;
    const avatar = (trigger.querySelector('.avatar-wrap') as HTMLElement) ?? trigger;
    return avatar.getBoundingClientRect();
  }

  /**
   * Opens the user profile dialog.
   * @param user$ The user observable.
   */
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

  /**
   * Logs out the current user.
   * @returns A promise that resolves when the operation is complete.
   */
  async logout() {
    await this.userService.markOnline(false);
    await signOut(this.auth);
    this.router.navigateByUrl('/');
  }

  /**
   * Sets a fallback avatar if the image fails to load.
   * @param evt The event.
   */
  fallbackAvatar(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/img-profile/profile.png';
  }
}
