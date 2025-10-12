import { Component, EventEmitter, Output, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import { Observable } from 'rxjs';

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
  ],
  templateUrl: './header-workspace.component.html',
  styleUrl: './header-workspace.component.scss',
})
export class HeaderWorkspaceComponent implements OnDestroy {
  private auth = inject(Auth);
  private router = inject(Router);
  private userService = inject(UserService);

  // Profil des eingeloggten Users //
  user$: Observable<User | null> = this.userService.currentUser$();

  fallbackAvatar(evt: Event) {
  const img = evt.target as HTMLImageElement;
  img.onerror = null;
  img.src = 'assets/img-profile/profile.png';
}

  // input feld//
  searchCtrl = new FormControl<string>('', { nonNullable: true });
  private sub?: Subscription;
  @Output() searchChange = new EventEmitter<string>();

  constructor() {
    this.sub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(q => this.searchChange.emit(q.trim()));
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigateByUrl('/');
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}