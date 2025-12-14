import { Component, inject, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SharedDataService } from '../../../../core/services/shared-data-service';
import { UserService } from '../../../../../services/user.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { Subscription } from 'rxjs';

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
  styleUrls: ['./avatar-selection-component.scss', './avatar-selection-component.responsive.scss'],
})
export class AvatarSelectComponent implements OnInit, OnDestroy {
  firestore: Firestore = inject(Firestore);
  auth: Auth = inject(Auth);
  selectedAvatar: string | null = null;
  loading = false;
  userData: any = null;

  snackBarSub?: Subscription;

  isEditMode = false;

  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private sharedUser: SharedDataService,
    private userService: UserService,
    @Optional() private dialogRef?: MatDialogRef<AvatarSelectComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data?: { user?: any }
  ) {}

  /**
   * Lifecycle hook: initializes component state.
   * Retrieves user data from shared service and redirects if missing.
   */
  ngOnInit(): void {
    this.userData = this.data?.user ?? this.sharedUser.getUser();
    this.isEditMode = !!this.data?.user;
    // Preselect avatar if already present on userData (useful for signups with default avatar or edit when opened)
    this.selectedAvatar = this.userData?.avatar ?? this.selectedAvatar;
    if (!this.userData) {
      this.router.navigate(['/signup']);
      return;
    }
  }

  /**
   * Lifecycle hook: cleans up subscriptions to avoid memory leaks.
   */
  ngOnDestroy(): void {
    this.snackBarSub?.unsubscribe();
  }

  /**
   * Sets the currently selected avatar path.
   *
   * @param avatarPath - Path to the avatar image.
   */
  selectAvatar(avatarPath: string) {
    this.selectedAvatar = avatarPath;
    if (!this.isEditMode && this.userData) {
      // also set userData.avatar so registration flow saves it
      this.userData.avatar = avatarPath;
    }
  }

  /**
   * Finalizes avatar selection and user registration.
   * Registers the user, adds them to the "everyone" channel, saves profile, and shows success.
   */
  async finishSelection() {
    if (this.isEditMode) {
      if (!this.selectedAvatar || !this.userData?.uid) return;
      this.loading = true;
      try {
        await this.userService.updateUserAvatar(this.userData.uid, this.selectedAvatar);
        this.loading = false;
        this.snackBar.open('Avatar erfolgreich aktualisiert!', '', {
          duration: 2500,
          panelClass: ['success-snackbar'],
        });
        this.dialogRef?.close();
      } catch (error) {
        console.error('Error updating avatar:', error);
        this.loading = false;
      }
      return;
    }

    if (!this.selectedAvatar) {
      this.snackBar.open('Bitte einen Avatar auswählen.', '', { duration: 3000 });
      return;
    }

    if (!this.isUserDataValid()) {
      this.snackBar.open(
        'Unvollständige Registrierung. Bitte prüfe Name, E-Mail und Passwort.',
        '',
        { duration: 3500 }
      );
      console.warn('finishSelection: user data invalid', this.userData);
      return;
    }

    if (this.isUserDataValid()) {
      this.loading = true;
      try {
        const user = await this.registerUser();
        await this.addNewUserToEveryoneChannel(user);
        await this.saveUserProfile(user);

        this.loading = false;
        this.showSuccessSnackbarAndProceed();
      } catch (error) {
        this.handleRegistrationError(error);
      }
    }
  }

  /**
   * Adds the newly registered user to the "everyone" channel in Firestore.
   *
   * @param user - The Firebase user object.
   */
  private async addNewUserToEveryoneChannel(user: any) {
    const channelsRef = collection(this.firestore, `channels`);
    const q = query(channelsRef, where('name', '==', 'everyone'));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return;
    const channelDoc = querySnapshot.docs[0];
    const channelRef = doc(this.firestore, 'channels', channelDoc.id);

    const memberData = this.defineMemberData(user);

    await setDoc(channelRef, { members: arrayUnion(memberData) }, { merge: true });
  }

  /**
   * Creates the member data object for the channel membership.
   *
   * @param user - Firebase user.
   * @returns Member data with `uid` and `displayName`.
   */
  private defineMemberData(user: any) {
    return {
      uid: user.uid,
      displayName: this.userData.name,
    };
  }

  /**
   * Validates whether required user data and selected avatar are present.
   *
   * @returns True if all required fields are set.
   */
  private isUserDataValid(): boolean {
    return (
      this.selectedAvatar && this.userData.email && this.userData.password && this.userData.name
    );
  }

  /**
   * Registers the user with email and password and updates their profile.
   *
   * @returns The Firebase user object.
   */
  private async registerUser() {
    const userCredential = await createUserWithEmailAndPassword(
      this.auth,
      this.userData.email,
      this.userData.password
    );

    const user = userCredential.user;
    await updateProfile(user, { displayName: this.userData.name });
    return user;
  }

  /**
   * Saves the user profile document to Firestore.
   *
   * @param user - Firebase user to persist.
   */
  private async saveUserProfile(user: any) {
    const userProfile = {
      uid: user.uid,
      name: this.userData.name,
      email: this.userData.email,
      avatar: this.selectedAvatar,
    };

    const userDocRef = doc(this.firestore, 'users', user.uid);
    await setDoc(userDocRef, userProfile);
  }

  /**
   * Handles registration errors by logging and resetting loading state.
   *
   * @param error - Error thrown during registration.
   */
  private handleRegistrationError(error: any) {
    console.error('Error during final registration:', error);
    this.loading = false;
    const message = error?.message ?? 'Registrierung fehlgeschlagen.';
    this.snackBar.open(message, '', { duration: 3500 });
  }

  /**
   * Shows a success snackbar, then navigates to the home route when dismissed.
   */
  showSuccessSnackbarAndProceed() {
    const snackBarRef = this.snackBar.open('Konto erfolgreich erstellt!', '', {
      duration: 2500,
      panelClass: ['success-snackbar'],
      verticalPosition: 'bottom',
      horizontalPosition: 'end',
    });

    this.snackBarSub = snackBarRef.afterDismissed().subscribe(() => {
      this.router.navigate(['']);
    });
  }

  /**
   * Navigates back to the signup route.
   */
  goBack() {
    if (this.isEditMode) {
      this.dialogRef?.close();
      return;
    }
    this.router.navigate(['/signup']);
  }
}
