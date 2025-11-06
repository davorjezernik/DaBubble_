import { Component, EventEmitter, Output, OnDestroy, OnInit, inject } from '@angular/core';
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
import { UserMenuDialogComponent } from '../../../../shared/components/user-menu-dialog.component/user-menu-dialog.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { SearchBusService } from '../../../../../services/search-bus.service';
import { UserMenuService } from '../../../../../services/user-menu.service';

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
  styleUrls: ['./header-workspace.component.scss', './header-workspace-component.responsive.scss'],
})
export class HeaderWorkspaceComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private dialog = inject(MatDialog);
  private bottomSheet = inject(MatBottomSheet);
  private searchBus = inject(SearchBusService);
  public userMenuService = inject(UserMenuService);

  // Profile of the logged-in user //
  user$: Observable<User | null> = this.userService.currentUser$();

  // input field //
  searchCtrl = new FormControl<string>('', { nonNullable: true });
  private sub?: Subscription;
  @Output() searchChange = new EventEmitter<string>();

  constructor() {
    this.sub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => {
        const v = (q ?? '').trim();
        this.searchChange.emit(v);    
        this.searchBus.set(v);          
      });
  }

  // Mark when logging in online //
  async ngOnInit() {
    await this.userService.markOnline(true);
  }

  // Menu for the top and from 400px below. //
  openUserMenu(evt: MouseEvent) {
  const trigger = evt.currentTarget as HTMLElement;
  const avatar  = (trigger.querySelector('.avatar-wrap') as HTMLElement) ?? trigger;
  const r = avatar.getBoundingClientRect();

  const GAP = 8;
  const MARGIN = 16;
  const MENU_W = (window.innerWidth <= 880) ? 350 : 300;

  // if smaller than 400px //
  if (window.innerWidth <= 400) {
    const ref = this.bottomSheet.open(UserMenuDialogComponent, {
      data: {},
      panelClass: 'user-menu-bottom'
    });
    ref.afterDismissed().pipe(take(1)).subscribe(action => {
      if (action === 'profile') this.openProfil();
      if (action === 'logout')  this.logout();
    });
    return;
  }

  // normal dialog menu //
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

  ref.afterClosed().pipe(take(1)).subscribe((action) => {
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
}
