import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Auth, confirmPasswordReset } from '@angular/fire/auth';
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-confirm-new-password',
  imports: [FormsModule],
  templateUrl: './confirm-new-password.component.html',
  styleUrl: './confirm-new-password.component.scss'
})
export class ConfirmNewPasswordComponent {
  auth: Auth = inject(Auth);

  newPassword: string = '';
  confirmPassword: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  onSubmit(): void {
    if (this.newPassword === this.confirmPassword) {
      this.successMessage = 'Passwort wurde erfolgreich zurückgesetzt.';
      this.errorMessage = '';
      return;
    } else {
      this.successMessage = '';
      this.errorMessage = 'Die Passwörter stimmen nicht überein.';
      return;
    }
  }

  private mapFirebaseError(code: string): string {
    if (code === 'auth/weak-password') {
      return 'Das Passwort ist zu schwach. Bitte wählen Sie ein stärkeres Passwort.';
    } else {
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }
  
}

