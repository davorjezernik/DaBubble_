import {
  Component,
  EventEmitter,
  Output,
  OnDestroy,
  OnInit,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { debounceTime, distinctUntilChanged, Subscription, Observable } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { DialogUserCardComponent } from '../../../../shared/components/dialog-user-card/dialog-user-card.component';
import { UserMenuDialogComponent } from '../user-menu-dialog.component/user-menu-dialog.component';

@Component({
  selector: 'app-header-workspace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDialogModule, 
  ],
  templateUrl: './header-workspace.component.html',
  styleUrl: './header-workspace.component.scss',
})
export class HeaderWorkspaceComponent implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private router = inject(Router);
  private userService = inject(UserService);
  private dialog = inject(MatDialog);

  // Profil des eingeloggten Users //
  user$: Observable<User | null> = this.userService.currentUser$();

  // input feld//
  searchCtrl = new FormControl<string>('', { nonNullable: true });
  private sub?: Subscription;
  @Output() searchChange = new EventEmitter<string>();

  constructor() {
    this.sub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.searchChange.emit(q.trim()));
  }

  // Beim Einloggen online markieren //
  async ngOnInit() {
    await this.userService.markOnline(true);
  }

  openUserMenu(evt: MouseEvent) {
    const trigger = evt.currentTarget as HTMLElement;
    const avatar = (trigger.querySelector('.avatar-wrap') as HTMLElement) ?? trigger;
    const r = avatar.getBoundingClientRect();
    const MENU_W = 260,
      GAP = 8,
      MARGIN = 8;

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
        if (action === 'profile') this.openProfil();
        if (action === 'logout') this.logout();
      });
  }

  openProfil() {
    this.user$.pipe(take(1)).subscribe((user) => {
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

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.userService.markOnline(false);
  }

  // Avatar-Fallback //
  fallbackAvatar(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/img-profile/profile.png';
  }
}
