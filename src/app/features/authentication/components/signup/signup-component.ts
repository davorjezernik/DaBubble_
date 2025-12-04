import { Component, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MyErrorStateMatcher } from './error-state-matcher';
import { MatCardModule } from '@angular/material/card';
import { Router, RouterLink } from '@angular/router';
import { SharedDataService } from '../../../../core/services/shared-data-service';
@Component({
  selector: 'app-dialog-signin-component',
  standalone: true,
  imports: [
    MatButtonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    CommonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatCardModule,
    RouterLink
],
  providers: [],
  templateUrl: './signup-component.html',
  styleUrls: ['./signup-component.scss', './signup-component.responsive.scss'],
})
export class SignupComponent {
  loading = false;

  signinForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    passwort: new FormControl('', [Validators.required, Validators.minLength(8)]),
    privacyPolicy: new FormControl(false, [Validators.requiredTrue]),
  });

  matcher = new MyErrorStateMatcher();

  constructor(private router: Router, private sharedData: SharedDataService) {}

  /**
   * Proceeds to avatar selection if the signup form is valid.
   * Collects form data and stores it via `SharedDataService`, then navigates.
   */
  proceedToAvatarSelection() {
    if (this.signinForm.valid) {
      const userData = {
        name: this.signinForm.value.name,
        email: this.signinForm.value.email,
        password: this.signinForm.value.passwort,
      };
      this.sharedData.setUser(userData);
      this.router.navigate(['/select-avatar']);
    }
  }

  /**
   * Navigates back to the login page.
   */
  goBack(): void {
    this.router.navigate(['/login']);
  }

   /**
   * HostListener that fires whenever the browser window is resized.
   * The method body is intentionally left empty because the resize
   * event itself is enough to trigger Angular's change detection,
   * causing dependent getters (such as the placeholder getter) to
   * be re-evaluated.
   */
  @HostListener('window:resize')
  onResize(): void {}
  /**
   * Returns the appropriate email placeholder depending on the current
   * window width. Angular re-evaluates this getter whenever change
   * detection runs (for example when `onResize` is triggered).
   *
   * - For screens ≤ 420px, a short example email is used.
   * - For larger screens, a longer example email is shown.
   *
   * @readonly
   * @returns {string} The email placeholder string based on screen size.
   */
  public get getEmailPlaceholder() {
    return window.innerWidth <= 420 ? 'beispiel@gmx.com' : 'beispielname@example.com';
  }
}
