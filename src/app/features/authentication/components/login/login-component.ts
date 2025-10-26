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
      .subscribe(() => this.updateErrorMessages());
  }

  updateErrorMessages() {
    this.updateEmailErrorMessage();
    this.updatePasswordErrorMessage();
  }

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

  isLoading = true;

  async login() {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.authService.loginWithEmail(email!, password!);
      await this.navigateToSelfDm();
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
        await this.navigateToSelfDm();
      }
    } catch (error) {
      console.error('Google sign-in error', error);
    }
  }

  async navigateToSelfDm() {
    const user = await firstValueFrom(this.authService.currentUser$);
    const selfDmUid = `${user?.uid}-${user?.uid}`;
    if (!user) return;
    this.router.navigate([`/workspace/dm/${selfDmUid}`]);
  }
}
