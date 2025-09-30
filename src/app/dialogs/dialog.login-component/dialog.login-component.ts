import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { AuthInputComponent } from '../../shared/components/auth-input-component/auth-input-component';
import { CommonModule } from '@angular/common';

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
  ],
  templateUrl: './dialog.login-component.html',
  styleUrl: './dialog.login-component.scss',
})
export class DialogLoginComponent {

  constructor() {}

  password: string = '';
  email: string = '';

  login() {
    console.log('Email:', this.email);
    console.log('Password:', this.password);
  }
}
