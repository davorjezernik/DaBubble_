import { Component, inject, NgZone } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
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
import { AuthInputComponent } from '../../../../shared/components/auth-input-component/auth-input-component';
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
    AuthInputComponent,
    RouterLink,
  ],
  templateUrl: './dialog.login-component.html',
  styleUrl: './dialog.login-component.scss',
})
export class DialogLoginComponent {
  constructor(public router: Router, private zone: NgZone) {}

  auth: Auth = inject(Auth);

  password: string = '';
  email: string = '';
  isLoading = true;

  login() {
    this.zone.run(async () => {
      try {
        const userCredential = await signInWithEmailAndPassword(
          this.auth,
          this.email,
          this.password
        );
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
