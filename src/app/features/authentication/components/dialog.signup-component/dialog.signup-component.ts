import { Component, EventEmitter, inject, Inject, Optional } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

import { Auth } from '@angular/fire/auth';
import { DialogAvatarSelectComponent } from '../dialog.avatar-select-component/dialog.avatar-select-component';
import { DialogLoginComponent } from '../dialog.login-component/dialog.login-component';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MyErrorStateMatcher } from './error-state-matcher';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { SharedDataService } from '../../../../core/services/shared-data-service';

@Component({
  selector: 'app-dialog-signin-component',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    CommonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatCardModule,
  ],
  providers: [],
  templateUrl: './dialog.signup-component.html',
  styleUrls: ['./dialog.signup-component.scss'],
})
export class DialogSignupComponent {

  loading = false;

  signinForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    passwort: new FormControl('', [Validators.required]),
    privacyPolicy: new FormControl(false, [Validators.requiredTrue]),
  });

  matcher = new MyErrorStateMatcher();

  constructor(private router: Router, private sharedData: SharedDataService) {
  }

  proceedToAvatarSelection() {
    if (this.signinForm.valid) {
        const userData = {
          name: this.signinForm.value.name,
          email: this.signinForm.value.email,
          password: this.signinForm.value.passwort,
        }
        this.sharedData.setUser(userData)
        this.router.navigate(['/select-avatar']);
    }
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}
