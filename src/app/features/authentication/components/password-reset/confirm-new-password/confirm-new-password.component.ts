import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, confirmPasswordReset } from '@angular/fire/auth';
import { NgIf, NgClass } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-new-password',
  imports: [FormsModule, NgIf, NgClass, RouterLink],
  templateUrl: './confirm-new-password.component.html',
  styleUrl: './confirm-new-password.component.scss'
})
export class ConfirmNewPasswordComponent implements OnInit, OnDestroy {
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);

  oobCode = '';

  newPassword: string = '';
  confirmPassword: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  routeSub?: Subscription;

  ngOnInit() {
    this.routeSub = this.route.queryParams.subscribe(params => {
      this.oobCode = params['oobCode'];
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }
  


  async onSubmit() {
    if (!this.isPasswordMatching()) return;
    if (!this.isCodeValid()) return;
    try {
      await this.resetPassword();
      this.handleSuccess();
    } catch (error: any) {
      this.handleError(error);
    }
  }

  private isPasswordMatching(): boolean {
    if (this.newPassword !== this.confirmPassword) {
      this.showError('Die Passwörter stimmen nicht überein.');
      return false;
    }
    return true;
  }

  private isCodeValid(): boolean {
    if (!this.oobCode) {
      this.showError('Ungültiger oder fehlender Code. Bitte überprüfen Sie den Link.');
      return false;
    }
    return true;
  }

  private async resetPassword() {
    await confirmPasswordReset(this.auth, this.oobCode, this.newPassword);
  }

  private handleSuccess() {
    this.showSuccess('Passwort wurde erfolgreich zurückgesetzt.');
    setTimeout(() => this.router.navigate(['/login']), 2000);
  }

  private handleError(error: any) {
    this.showError(this.mapFirebaseError(error.code));
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
  }


  private mapFirebaseError(code: string): string {
    switch (code) {
      case 'auth/expired-action-code':
        return 'Der Link ist abgelaufen. Bitte fordern Sie eine neue E-Mail an.';
      case 'auth/invalid-action-code':
        return 'Der Link ist ungültig. Bitte fordern Sie eine neue E-Mail an.';
      default:
        return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }
  
}

