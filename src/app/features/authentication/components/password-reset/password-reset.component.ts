import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; 
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-password-reset',
  imports: [FormsModule, NgIf],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss'
})

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
    }
  }
}
