import { Component, Inject, inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialog,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { DialogSignupComponent } from '../dialog.signup-component/dialog.signup-component';
import { DialogLoginComponent } from '../dialog.login-component/dialog.login-component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-dialog-avatar-select-component',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dialog.avatar-select-component.html',
  styleUrl: './dialog.avatar-select-component.scss',
})
export class DialogAvatarSelectComponent {
  firestore: Firestore = inject(Firestore);
  auth: Auth = inject(Auth);
  selectedAvatar: string | null = null;
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<DialogAvatarSelectComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string; email: string; password: string },
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  selectAvatar(avatarPath: string) {
    this.selectedAvatar = avatarPath;
  }

  async finishSelection() {
    if (this.selectedAvatar && this.data.email && this.data.password && this.data.name) {
      this.loading = true;
      try {
        // Step 1: Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
          this.auth,
          this.data.email,
          this.data.password
        );
        const user = userCredential.user;

        // Step 2: Update the new user's profile with the name
        await updateProfile(user, { displayName: this.data.name });

        // Step 3: Store additional user data in Firestore
        const userProfile = {
          uid: user.uid,
          name: this.data.name,
          email: this.data.email,
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
      this.dialogRef.close();
      this.dialog.open(DialogLoginComponent);
    });
  }

  goBack() {
    this.dialogRef.close();
    this.dialog.open(DialogSignupComponent, {
      data: {
        name: this.data.name,
        email: this.data.email,
        passwort: this.data.password,
      },
    });
  }
}
