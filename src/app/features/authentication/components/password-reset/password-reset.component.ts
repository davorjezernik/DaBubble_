import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // ✅ correct import
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
      await sendPasswordResetEmail(this.auth, this.email);
      this.errorMessage = '';
      this.successMessage = 'E-Mail zum Zurücksetzen wurde erfolgreich gesendet!';
      this.email = '';
      setTimeout(() => {
        this.successMessage = '';
        this.router.navigate(['/']); 
      }, 300000);
    } catch (error: any) {
      this.successMessage = '';
      this.errorMessage = this.mapFirebaseError(error.code);
      setTimeout(() => {
        this.errorMessage = '';
      }, 300000);
    }
  }

  private mapFirebaseError(code: string): string {
    if (code === 'auth/user-not-found') {
      return 'Es wurde kein Benutzer mit dieser E-Mail gefunden.';
    } else {
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }
}
