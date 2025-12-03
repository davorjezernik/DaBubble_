import { inject, Injectable, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Auth,
  authState,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  User,
  deleteUser,
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

  // Lazy initialization mit Getter (verhindert Injection Context Warnung)
  public get currentUser$(): Observable<User | null> {
    if (!this._currentUser$) {
      this._currentUser$ = runInInjectionContext(this.env, () => 
        authState(this.auth)
      );
    }
    return this._currentUser$;
  }

  constructor() {
    // Empty constructor - currentUser$ wird beim ersten Zugriff initialisiert
  }

  loginWithEmail(email: string, password: string): Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  signInWithGoogle(): Promise<any> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

  // guest logIn //
  async loginAsGuest(): Promise<User> {
    const { email, password } = environment.guest;
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    return cred.user;
  }

  isGuest(user: User | null): boolean {
    return !!user && user.uid === environment.guest.uid;
  }
  // guest logIn //

  async logout(): Promise<void> {
    await this.auth.signOut();
  }
}
