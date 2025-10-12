import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
import { AuthService } from '../../../services/auth-service';

export const workspaceRedirectGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  // 1. Get the tools we need
  const authService = inject(AuthService);
  const router = inject(Router);

  // 2. Look at the user stream from the AuthService
  return authService.currentUser$.pipe(
    // 3. We only need the *first* value to make a decision
    take(1),
    // 4. Transform the user object into a decision
    map(user => {
      if (user && user.uid) {
        // 5. If the user exists, create a redirect command to their own DM
        console.log(`User ${user.uid} found. Redirecting to their DM.`);
        return router.createUrlTree(['/workspace/dm', user.uid]);
      } else {
        // 6. As a safety net, if there's no user, send them to login
        console.log('No user found. Redirecting to login.');
        return router.createUrlTree(['/login']);
      }
    })
  );
};