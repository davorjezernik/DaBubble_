import { inject, Injectable } from '@angular/core';
import { Auth, authState, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  public readonly currentUser$: Observable<User | null>;

    constructor() {
    this.currentUser$ = authState(this.auth);
  }

    loginWithEmail(email: string, password: string):Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

    signInWithGoogle():Promise<any> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
    
  }

    logout():Promise<void> {
    return this.auth.signOut();
  }
}
