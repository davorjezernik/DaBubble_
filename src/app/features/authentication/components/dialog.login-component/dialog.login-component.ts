import { Component, inject, NgZone, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, FormGroup, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
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
    ReactiveFormsModule
],
  templateUrl: './dialog.login-component.html',
  styleUrl: './dialog.login-component.scss',
})
export class DialogLoginComponent {
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  errorMessage = signal('');

  constructor(public router: Router, private zone: NgZone) {
    merge(this.loginForm.controls.email.statusChanges, this.loginForm.controls.email.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateErrorMessage());
  }

  updateErrorMessage() {
    if (this.loginForm.controls.email.hasError('required')) {
      this.errorMessage.set('You must enter a value');
    } else if (this.loginForm.controls.email.hasError('email')) {
      this.errorMessage.set('Not a valid email');
    } else {
      this.errorMessage.set('');
    }
  }

  auth: Auth = inject(Auth);
  isLoading = true;

  login() {
    if (this.loginForm.invalid) {
      return;
    }
    const { email, password } = this.loginForm.getRawValue();

    this.zone.run(async () => {
      try {
        const userCredential = await signInWithEmailAndPassword(this.auth, email!, password!);
        this.router.navigate(['/workspace']);
      } catch (err: any) {
        console.log(err);
      }
    });
  }

  signInWithGoogle() {
    this.zone.run(async () => {
      const provider = new GoogleAuthProvider();
      try {
        const userCredential = await signInWithPopup(this.auth, provider);
        const additionalInfo = getAdditionalUserInfo(userCredential);
        console.log('Google sign-in successful:', additionalInfo);
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
    });
  }
}
