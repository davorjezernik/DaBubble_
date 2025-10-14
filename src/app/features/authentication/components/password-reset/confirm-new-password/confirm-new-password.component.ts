import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth, confirmPasswordReset } from '@angular/fire/auth';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-confirm-new-password',
  imports: [FormsModule, NgIf],
  templateUrl: './confirm-new-password.component.html',
  styleUrl: './confirm-new-password.component.scss',
})
export class ConfirmNewPasswordComponent implements OnInit {
  newPassword: string = '';
  confirmPassword: string = '';
  oobCode: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.oobCode = params['oobCode'];
    });
  }

  async onSubmit() {
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwörter stimmen nicht überein.';
      return;
    }

    try {
      await confirmPasswordReset(this.auth, this.oobCode, this.newPassword);
      this.successMessage = 'Passwort wurde erfolgreich zurückgesetzt.';
      this.errorMessage = '';
    } catch (error: any) {
      console.error(error);
      this.successMessage = '';
      this.errorMessage = this.mapFirebaseError(error.code);
    }
  }

  private mapFirebaseError(code: string): string {
    switch (code) {
      case 'auth/expired-action-code':
        return 'Der Link ist abgelaufen.';
      case 'auth/invalid-action-code':
        return 'Ungültiger Link.';
      case 'auth/user-disabled':
        return 'Benutzerkonto ist deaktiviert.';
      default:
        return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
    }
  }
}
