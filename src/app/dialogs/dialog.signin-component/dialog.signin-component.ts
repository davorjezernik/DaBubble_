import { Component, inject } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { User } from '../../../models/user.class';
import { MyErrorStateMatcher } from '../error-state-matcher';

@Component({
  selector: 'app-dialog-signin-component',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule
  ],
  providers: [],
  templateUrl: './dialog.signin-component.html',
  styleUrls: ['./dialog.signin-component.scss']
})
export class DialogSigninComponent {
  firestore: Firestore = inject(Firestore);
  loading = false;

  signinForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    passwort: new FormControl('', [Validators.required]),
  });

  matcher = new MyErrorStateMatcher();

  constructor(public dialogRef: MatDialogRef<DialogSigninComponent>) {}

  async saveUser() {
    if (this.signinForm.valid) {
      this.loading = true;
      const user = new User(this.signinForm.value);
      try {
        const userCollection = collection(this.firestore, 'users');
        await addDoc(userCollection, user.toJSON());
        console.log('Benutzer erfolgreich in Firestore gespeichert:', user);
        this.loading = false;
        this.dialogRef.close(user);
      } catch (error) {
        console.error('Fehler beim Speichern des Benutzers:', error);
        this.loading = false;
      }
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}



