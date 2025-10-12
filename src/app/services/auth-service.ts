import { inject, Injectable } from '@angular/core';
import { Auth, authState, User } from '@angular/fire/auth';
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
}
