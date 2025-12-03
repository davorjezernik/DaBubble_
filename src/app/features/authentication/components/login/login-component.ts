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
import { AuthService } from '../../../../../services/auth-service';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../../../../services/user.service';

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

  isLoading = true;

  constructor(
    public router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {
    merge(this.loginForm.controls.email.statusChanges, this.loginForm.controls.email.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateErrorMessages());
  }

  /**
   * Updates both email and password error messages based on form control state.
   */
  updateErrorMessages() {
    this.updateEmailErrorMessage();
    this.updatePasswordErrorMessage();
  }

  /**
   * Sets a user-friendly error message for the email field.
   */
  updateEmailErrorMessage() {
    const emailControl = this.loginForm.controls.email;
    if (emailControl.hasError('loginFailed')) {
      this.emailErrorMessage.set('Falsches Passwort oder E-Mail. Bitte noch einmal versuchen.');
    } else if (emailControl.hasError('required') || emailControl.hasError('email')) {
      this.emailErrorMessage.set('Diese E-Mail-Adresse ist leider ungültig.');
    } else {
      this.emailErrorMessage.set('');
    }
  }

  /**
   * Sets a user-friendly error message for the password field.
   */
  updatePasswordErrorMessage() {
    const passwordControl = this.loginForm.controls.password;
    if (passwordControl.hasError('loginFailed')) {
      this.passwordErrorMessage.set('Falsches Passwort oder E-Mail. Bitte noch einmal versuchen.');
    } else if (passwordControl.hasError('required')) {
      this.passwordErrorMessage.set('Bitte geben Sie Ihr Passwort ein.');
    } else {
      this.passwordErrorMessage.set('');
    }
  }

  /**
   * Attempts to log in the user with email and password.
   * On failure, marks controls with `loginFailed` error and updates messages.
   */
  async login() {
    if (this.loginForm.invalid) return;
    const { email, password } = this.loginForm.getRawValue();
    try {
      await this.authService.loginWithEmail(email!, password!);
      await this.navigateToSelfDm();
    } catch (err: any) {
      this.setErrorMessages();
    }
  }

  /**
   * Marks form controls with a `loginFailed` error and updates the messages.
   */
  private setErrorMessages() {
    this.loginForm.controls.email.setErrors({ loginFailed: true });
    this.loginForm.controls.password.setErrors({ loginFailed: true });
    this.updateErrorMessages();
  }

  /**
   * Initiates Google sign-in and processes the resulting user state.
   */
  async signInWithGoogle() {
    try {
      const userCredential = await this.authService.signInWithGoogle();
      const additionalInfo = getAdditionalUserInfo(userCredential);
      this.processGoogleUser(additionalInfo, userCredential);
    } catch (error) {
      console.error('Google sign-in error', error);
    }
  }

  /**
   * Handles the Google user flow depending on whether the user is new or existing.
   * Deletes newly created users (to prevent dangling accounts) or navigates to self-DM.
   *
   * @param additionalInfo - Additional info from Google sign-in.
   * @param userCredential - Firebase user credential object.
   */
  private async processGoogleUser(additionalInfo: any, userCredential: any) {
    if (additionalInfo?.isNewUser) {
      if (userCredential.user) {
        await deleteUser(userCredential.user);
      }
    } else {
      await this.navigateToSelfDm();
    }
  }

  /**
   * Navigates to the user's self direct message chat.
   */
  async navigateToSelfDm() {
    const user = await firstValueFrom(this.authService.currentUser$);
    const selfDmUid = `${user?.uid}-${user?.uid}`;
    if (!user) return;
    this.router.navigate([`/workspace/dm/${selfDmUid}`]);
  }

  /**
   * Logs in as a guest, marks the user online, and navigates to self-DM.
   */
  async loginAsGuest() {
    try {
      await this.authService.loginAsGuest();
      await this.userService.markOnline(true);
      await this.navigateToSelfDm();
    } catch (err) {
      console.error('Guest login failed', err);
    }
  }
}
