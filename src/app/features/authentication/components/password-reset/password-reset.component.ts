<<<<<<< HEAD
import { Component, inject, NgZone, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
=======
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; 
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-password-reset',
  imports: [FormsModule, NgIf],
>>>>>>> pw-reset
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
<<<<<<< HEAD
export class PasswordResetComponent {
  auth: Auth = inject(Auth);
  router: Router = inject(Router);
  zone: NgZone = inject(NgZone);
  snackBar: MatSnackBar = inject(MatSnackBar);

  email = signal('');
  errorMessage = signal('');
  isLoading = signal(false);

  async sendReset() {
    const email = this.email();
    this.errorMessage.set('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMessage.set('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    this.isLoading.set(true);
    try {
      // Build an actionCodeSettings object so the email link returns the user to the app.
      // This defaults to the current origin and the '/pw-reset/confirm' route.
      const continueUrl = `${window.location.origin}/pw-reset/confirm`;
      const actionCodeSettings = {
        url: continueUrl,
        // If you plan to handle the password reset in the web app (catching the oobCode),
        // set handleCodeInApp to true. For a redirect flow, use false.
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(this.auth, email, actionCodeSettings);
      this.snackBar.open('Reset-E-Mail gesendet. Bitte prüfe dein Postfach.', '', {
        duration: 3000,
        panelClass: ['success-snackbar'],
        verticalPosition: 'bottom',
        horizontalPosition: 'end',
      });

      // navigate to confirm screen if exists, otherwise stay
      try {
        this.zone.run(() => this.router.navigate(['/pw-reset', 'confirm']));
      } catch {
        // ignore navigation error
      }
    } catch (err: any) {
      console.error('Password reset error', err);
      const code = err?.code ?? '';
      if (code.includes('user-not-found')) {
        this.errorMessage.set('Kein Benutzer mit dieser E-Mail gefunden.');
      } else if (code.includes('invalid-email')) {
        this.errorMessage.set('Ungültige E-Mail-Adresse.');
      } else {
        this.errorMessage.set('Fehler beim Senden der E-Mail. Bitte versuche es später erneut.');
      }
    } finally {
      this.isLoading.set(false);
=======

export class PasswordResetComponent {
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router); 

  email: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  async onSubmit() {
    try {
      await this.handlePasswordReset();
    } catch (error: any) {
      this.handleError(error);
    }
  }

  private async handlePasswordReset() {
    await sendPasswordResetEmail(this.auth, this.email);
    this.showSuccessMessage('E-Mail zum Zurücksetzen wurde erfolgreich gesendet!');
    this.resetEmailField();
    this.navigateAfterDelay('/');
  }

  private handleError(error: any) {
    this.clearSuccessMessage();
    this.showErrorMessage(this.mapFirebaseError(error.code));
  }

  private showSuccessMessage(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
  }

  private showErrorMessage(message: string) {
    this.errorMessage = message;
    setTimeout(() => (this.errorMessage = ''), 2000);
  }

  private clearSuccessMessage() {
    this.successMessage = '';
  }

  private resetEmailField() {
    this.email = '';
  }

  private navigateAfterDelay(path: string) {
    setTimeout(() => {
      this.successMessage = '';
      this.router.navigate([path]);
    }, 2000);
  }

  private mapFirebaseError(code: string): string {
    if (code === 'auth/user-not-found') {
      return 'Es wurde kein Benutzer mit dieser E-Mail gefunden.';
    } else {
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
>>>>>>> pw-reset
    }
  }
}
