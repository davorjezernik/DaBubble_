import { Component, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth, GoogleAuthProvider, signInWithRedirect } from '@angular/fire/auth';
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
    RouterLink
],
  templateUrl: './dialog.login-component.html',
  styleUrl: './dialog.login-component.scss',
})
export class DialogLoginComponent {
  constructor(public router: Router) {}

  auth: Auth = inject(Auth);

  password: string = '';
  email: string = '';

  login() {
    console.log('Email:', this.email);
    console.log('Password:', this.password);
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    // This will navigate the user away, so the code below will not execute immediately.
    await signInWithRedirect(this.auth, provider);
  }
}
