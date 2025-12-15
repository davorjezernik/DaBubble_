import { Component, HostListener, signal } from '@angular/core';
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
import { deleteUser, getAdditionalUserInfo } from '@angular/fire/auth';
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
  styleUrls: ['./login-component.scss', './login-component.responsive.scss'],
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
    this.loginForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.resetLoginFailedError();
    });

    merge(
      this.loginForm.controls.email.statusChanges,
      this.loginForm.controls.email.valueChanges,
      this.loginForm.controls.password.statusChanges,
      this.loginForm.controls.password.valueChanges
    )
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
    } catch (err: any) {
      this.setErrorMessages();
    } finally {
      await this.navigateToSelfDm();
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
   * Resets the `loginFailed` error from all form controls.
   */
  private resetLoginFailedError() {
    for (const key in this.loginForm.controls) {
      const control = this.loginForm.get(key);
      if (control && control.hasError('loginFailed')) {
        delete control.errors!['loginFailed'];
        control.updateValueAndValidity({ emitEvent: false });
      }
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

  /**
   * HostListener that fires whenever the browser window is resized.
   * The method body is intentionally left empty because the resize
   * event itself is enough to trigger Angular's change detection,
   * causing dependent getters (such as the placeholder getter) to
   * be re-evaluated.
   */
  @HostListener('window:resize')
  onResize(): void {}
  /**
   * Returns the appropriate email placeholder depending on the current
   * window width. Angular re-evaluates this getter whenever change
   * detection runs (for example when `onResize` is triggered).
   *
   * - For screens ≤ 420px, a short example email is used.
   * - For larger screens, a longer example email is shown.
   *
   * @readonly
   * @returns {string} The email placeholder string based on screen size.
   */
  public get getEmailPlaceholder() {
    return window.innerWidth <= 420 ? 'beispiel@gmx.com' : 'beispielname@example.com';
  }
}
