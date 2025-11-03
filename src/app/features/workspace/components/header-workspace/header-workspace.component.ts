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
  styleUrl: './header-workspace.component.scss',
})
export class HeaderWorkspaceComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  public userMenuService = inject(UserMenuService);

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
  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.userService.markOnline(false);
  }
}
