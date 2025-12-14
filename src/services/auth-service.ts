import { inject, Injectable, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  User,
  UserCredential,
} from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private env = inject(EnvironmentInjector);
  private _currentUser$?: Observable<User | null>;

  /**
   * Lazy initialization with getter to prevent Injection Context warning.
   * @returns An observable of the current user or null.
   */
  public get currentUser$(): Observable<User | null> {
    if (!this._currentUser$) {
      this._currentUser$ = runInInjectionContext(this.env, () => authState(this.auth));
    }
    return this._currentUser$;
  }

  constructor() {}

  /**
   * Logs in a user with email and password.
   * @param email The user's email.
   * @param password The user's password.
   * @returns A promise that resolves with the user credentials.
   */
  loginWithEmail(email: string, password: string): Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Signs in a user with Google.
   * @returns A promise that resolves with the user credentials.
   */
  signInWithGoogle(): Promise<any> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

  /**
   * Logs in as a guest. If the guest user doesn't exist, it creates the user first.
   * @returns A promise that resolves with the user credential.
   */
  async loginAsGuest(): Promise<UserCredential> {
    const { email, password } = environment.guest;
    try {
      return await this.loginWithEmail(email, password);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // If guest user does not exist, create it
        return await createUserWithEmailAndPassword(this.auth, email, password);
      }
      // For other errors, re-throw
      throw error;
    }
  }

  /**
   * Checks if the user is a guest.
   * @param user The user to check.
   * @returns True if the user is a guest, false otherwise.
   */
  isGuest(user: User | null): boolean {
    return !!user && user.uid === environment.guest.uid;
  }

  /**
   * Logs out the current user.
   * @returns A promise that resolves when the operation is complete.
   */
  async logout(): Promise<void> {
    await this.auth.signOut();
  }
}
