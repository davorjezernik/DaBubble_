import { Component, NgZone, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import {
  FormControl,
  FormGroup,
  FormsModule,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { deleteUser, getAdditionalUserInfo, GoogleAuthProvider } from '@angular/fire/auth';
import { Router, RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../services/auth-service';
@Component({
  selector: 'app-dialog-login',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    FormsModule,
    RouterLink,
    MatIcon,
    ReactiveFormsModule,
  ],
  templateUrl: './login-component.html',
  styleUrl: './login-component.scss',
})
export class LoginComponent {
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  emailErrorMessage = signal('');
  passwordErrorMessage = signal('');

  constructor(public router: Router, private zone: NgZone, private authService: AuthService) {
    merge(this.loginForm.controls.email.statusChanges, this.loginForm.controls.email.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateErrorMessage());
  }

  updateErrorMessage() {
    // Email errors
    const emailControl = this.loginForm.controls.email;
    if (emailControl.hasError('required')) {
      this.emailErrorMessage.set('Diese E-Mail-Adresse ist leider ungültig.');
    }

    // Password errors
    const passwordControl = this.loginForm.controls.password;
    if (passwordControl.hasError('required')) {
      this.passwordErrorMessage.set('Falsches Passwort oder E-Mail. Bitten noch einmal versuchen.');
    } else {
      this.passwordErrorMessage.set('');
    }
  }

  isLoading = true;

  async login() {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.authService.loginWithEmail(email!, password!);
      this.router.navigate(['/workspace']);
    } catch (err: any) {
      console.log(err);
    }
  }

  async signInWithGoogle() {
    try {
      const userCredential = await this.authService.signInWithGoogle();
      const additionalInfo = getAdditionalUserInfo(userCredential);

      if (additionalInfo?.isNewUser) {
        if (userCredential.user) {
          await deleteUser(userCredential.user);
        }
      } else {
        this.router.navigate(['/workspace']);
      }
    } catch (error) {
      console.error('Google sign-in error', error);
    }
  }
}
