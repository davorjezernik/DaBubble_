import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-password-reset',
  imports: [FormsModule, NgIf],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss'
})
export class PasswordResetComponent {
  auth: Auth = inject(Auth);
  router: RouterModule = inject(RouterModule);

  email: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  async onSubmit() {
    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.successMessage = 'E-Mail zum Zurücksetzen des Passworts wurde gesendet.';
      this.errorMessage = '';
    } catch (error: any) {
      this.successMessage = '';
      this.errorMessage = this.mapFirebaseError(error.code);
    }
  }

  private mapFirebaseError(code: string): string {
    if (code === 'auth/user-not-found') {
      return 'Es wurde kein Benutzer mit dieser E-Mail gefunden.';
    } else if (code === 'auth/invalid-email') {
      return 'Die eingegebene E-Mail-Adresse ist ungültig.';
    } else {
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }

}
