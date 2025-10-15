import { Component, inject, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SharedDataService } from '../../../../core/services/shared-data-service';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dialog-avatar-select-component',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCardModule,
  ],
  templateUrl: './avatar-selection-component.html',
  styleUrl: './avatar-selection-component.scss',
})
export class AvatarSelectComponent implements OnInit {
  firestore: Firestore = inject(Firestore);
  auth: Auth = inject(Auth);
  selectedAvatar: string | null = null;
  loading = false;
  userData: any = null;

  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private sharedUser: SharedDataService
  ) {}

  ngOnInit(): void {
    this.userData = this.sharedUser.getUser();
    if (!this.userData) {
      this.router.navigate(['/signup']);
      return;
    }
  }

  selectAvatar(avatarPath: string) {
    this.selectedAvatar = avatarPath;
  }

  async finishSelection() {
    if (
      this.selectedAvatar &&
      this.userData.email &&
      this.userData.password &&
      this.userData.name
    ) {
      this.loading = true;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          this.auth,
          this.userData.email,
          this.userData.password
        );
        const user = userCredential.user;

        await updateProfile(user, { displayName: this.userData.name });

        const userProfile = {
          uid: user.uid,
          name: this.userData.name,
          email: this.userData.email,
          avatar: this.selectedAvatar,
        };

        const userDocRef = doc(this.firestore, 'users', user.uid);
        await setDoc(userDocRef, userProfile);

        this.loading = false;
        this.showSuccessSnackbarAndProceed();
      } catch (error) {
        console.error('Error during final registration:', error);
        this.loading = false;
      }
    }
  }

  showSuccessSnackbarAndProceed() {
    const snackBarRef = this.snackBar.open('Konto erfolgreich erstellt!', '', {
      duration: 2500,
      panelClass: ['success-snackbar'],
      verticalPosition: 'bottom',
      horizontalPosition: 'end',
    });

    snackBarRef.afterDismissed().subscribe(() => {
      this.router.navigate(['']);
    });
  }

  goBack() {
    this.router.navigate(['/signup']);
  }
}
