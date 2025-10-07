import { Component, inject, NgZone, signal } from '@angular/core';
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
import {
  Auth,
  deleteUser,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from '@angular/fire/auth';
import { Router, RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-dialog-login',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    RouterLink,
    MatIcon,
    ReactiveFormsModule,
  ],
  templateUrl: './dialog.login-component.html',
  styleUrl: './dialog.login-component.scss',
})
export class DialogLoginComponent {
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  emailErrorMessage = signal('');
  passwordErrorMessage = signal('');

  constructor(public router: Router, private zone: NgZone) {
    merge(this.loginForm.controls.email.statusChanges, this.loginForm.controls.email.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateErrorMessage());
  }

  updateErrorMessage() {
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

  auth: Auth = inject(Auth);
  isLoading = true;

  login() {
    const { email, password } = this.loginForm.getRawValue();

    this.zone.run(async () => {
      try {
        const userCredential = await signInWithEmailAndPassword(this.auth, email!, password!);
        this.router.navigate(['/workspace']);
      } catch (err: any) {
        this.loginForm.controls.email.setErrors({ loginFailed: true });
        this.loginForm.controls.password.setErrors({ loginFailed: true });
        this.updateErrorMessage();
      }
    });
  }

  signInWithGoogle() {
    this.zone.run(async () => {
      const provider = new GoogleAuthProvider();
      try {
        await this.trySignInWithGoogle(provider);
      } catch (error) {
        this.loginForm.controls.email.setErrors({ loginFailed: true });
        this.loginForm.controls.password.setErrors({ loginFailed: true });
        this.updateErrorMessage();
      }
    });
  }

  async trySignInWithGoogle(provider: any) {
    const userCredential = await signInWithPopup(this.auth, provider);
    const additionalInfo = getAdditionalUserInfo(userCredential);
    if (additionalInfo?.isNewUser) {
      if (userCredential.user) {
        await deleteUser(userCredential.user);
      }
    } else {
      this.router.navigate(['/workspace']);
    }
  }
}
