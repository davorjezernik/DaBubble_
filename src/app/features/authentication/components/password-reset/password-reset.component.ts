import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-password-reset',
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  email: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  /**
   * Handles form submission for password reset.
   * Tries to send the reset email and sets UI messages accordingly.
   */
  async onSubmit() {
    try {
      await this.handlePasswordReset();
    } catch (error: any) {
      this.handleError(error);
    }
  }

  /**
   * Sends a password reset email to the entered address and
   * shows a success message before navigating back to the home route.
   */
  private async handlePasswordReset() {
    await sendPasswordResetEmail(this.auth, this.email);
    this.showSuccessMessage('E-Mail zum Zurücksetzen wurde erfolgreich gesendet!');
    this.resetEmailField();
    this.navigateAfterDelay('/');
  }

  /**
   * Handles and displays an error that occurs during password reset.
   *
   * @param error - Error object thrown by Firebase.
   */
  private handleError(error: any) {
    this.clearSuccessMessage();
    this.showErrorMessage(this.mapFirebaseError(error.code));
  }

  /**
   * Shows a success message and clears any previous error.
   *
   * @param message - Text to display as success.
   */
  private showSuccessMessage(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
  }

  /**
   * Shows an error message temporarily.
   *
   * @param message - Text to display as error.
   */
  private showErrorMessage(message: string) {
    this.errorMessage = message;
    setTimeout(() => (this.errorMessage = ''), 2000);
  }

  /**
   * Clears any success message.
   */
  private clearSuccessMessage() {
    this.successMessage = '';
  }

  /**
   * Resets the email input field.
   */
  private resetEmailField() {
    this.email = '';
  }

  /**
   * Navigates to a route after a short delay and clears success message.
   *
   * @param path - Router path to navigate to.
   */
  private navigateAfterDelay(path: string) {
    setTimeout(() => {
      this.successMessage = '';
      this.router.navigate([path]);
    }, 2000);
  }

  /**
   * Maps Firebase auth errors to user-friendly messages.
   *
   * @param code - Firebase error code.
   * @returns Localized error description.
   */
  private mapFirebaseError(code: string): string {
    if (code === 'auth/user-not-found') {
      return 'Es wurde kein Benutzer mit dieser E-Mail gefunden.';
    } else {
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }
}
