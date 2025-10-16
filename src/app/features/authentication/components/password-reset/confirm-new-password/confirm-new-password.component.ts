import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, confirmPasswordReset } from '@angular/fire/auth';
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-confirm-new-password',
  imports: [FormsModule, NgIf],
  templateUrl: './confirm-new-password.component.html',
  styleUrl: './confirm-new-password.component.scss'
})
export class ConfirmNewPasswordComponent {
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);

  oobCode = '';

  newPassword: string = '';
  confirmPassword: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.oobCode = params['oobCode'];
    });
  }

 async onSubmit() {
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Die Passwörter stimmen nicht überein.';
      this.successMessage = '';
      return;
    }

    if (!this.oobCode) {
      this.errorMessage = 'Ungültiger oder fehlender Code. Bitte überprüfen Sie den Link.';
      return;
    }

    try {
      await confirmPasswordReset(this.auth, this.oobCode, this.newPassword);
      this.successMessage = 'Passwort wurde erfolgreich zurückgesetzt.';
      this.errorMessage = '';

      setTimeout(() => this.router.navigate(['/login']), 3000);
    } catch (error: any) {
      this.errorMessage = this.mapFirebaseError(error.code);
      this.successMessage = '';
    }
  }

private mapFirebaseError(code: string): string {
    switch (code) {
      case 'auth/weak-password':
        return 'Das Passwort ist zu schwach. Bitte wählen Sie ein stärkeres Passwort.';
      case 'auth/expired-action-code':
        return 'Der Link ist abgelaufen. Bitte fordern Sie eine neue E-Mail an.';
      case 'auth/invalid-action-code':
        return 'Der Link ist ungültig. Bitte fordern Sie eine neue E-Mail an.';
      default:
        return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }
  
}

