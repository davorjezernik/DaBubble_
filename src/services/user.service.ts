import {
  Injectable,
  inject,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  collection,
  collectionData,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  Auth,
  authState,
  updateProfile,
} from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError, shareReplay } from 'rxjs/operators';
import { User } from '../models/user.class';

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(EnvironmentInjector);

  // Observable Caching (TIER 1, Fix 2)
  private usersCache$?: Observable<User[]>;
  private userByIdCache = new Map<string, Observable<User | null>>();

  async markOnline(online: boolean) {
    const u = this.auth.currentUser;
    if (!u) return;

    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'users', u.uid);
      try {
        await updateDoc(ref, {
          online,
          lastActive: serverTimestamp(),
        });
      } catch (e) {
        console.warn('markOnline failed', e);
      }
    });
  }

  users$(): Observable<User[]> {
    if (!this.usersCache$) {
      this.usersCache$ = runInInjectionContext(this.injector, () => {
        const ref = collection(this.firestore, 'users');
        const q = query(ref, orderBy('name'));

        return collectionData(q, { idField: 'uid' }).pipe(
          map((docs: any[]) =>
            docs
              .map(
                (d) =>
                  new User({
                    ...d,
                    name: String(d?.name ?? ''),
                    avatar: this.normalizeAvatar(d?.avatar),
                    online: !!d?.online,
                  })
              )
              .sort((a, b) =>
                String(a.name ?? '').localeCompare(
                  String(b.name ?? ''),
                  undefined,
                  { sensitivity: 'base' }
                )
              )
          ),
          shareReplay({ bufferSize: 1, refCount: true })
        );
      });
    }
    return this.usersCache$;
  }

  userById$(uid: string): Observable<User | null> {
    if (!this.userByIdCache.has(uid)) {
      const user$ = runInInjectionContext(this.injector, () => {
        const ref = doc(this.firestore, 'users', uid);

        return docData(ref, { idField: 'uid' }).pipe(
          map((d: any | undefined) =>
            d
              ? new User({
                  ...d,
                  avatar: this.normalizeAvatar(d.avatar),
                  online: !!d.online,
                })
              : null
          ),
          catchError(() => of(null)),
          shareReplay({ bufferSize: 1, refCount: true })
        );
      });
      this.userByIdCache.set(uid, user$);
    }
    return this.userByIdCache.get(uid)!;
  }

  currentUser$(): Observable<User | null> {
    return runInInjectionContext(this.injector, () =>
      authState(this.auth).pipe(
        switchMap((u) => {
          if (!u) return of(null);

          return this.userById$(u.uid).pipe(
            map(
              (profile) =>
                profile ??
                new User({
                  uid: u.uid,
                  name: u.displayName || u.email || 'Unbekannt',
                  email: u.email || '',
                  avatar: this.normalizeAvatar(u.photoURL || ''),
                  online: true,
                })
            )
          );
        })
      )
    );
  }

  async updateUserName(uid: string, name: string) {
    const newName = String(name ?? '').trim();

    return runInInjectionContext(this.injector, async () => {
      const userRef = doc(this.firestore, `users/${uid}`);
      await updateDoc(userRef, { name: newName });

      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, { displayName: newName });
      }

      // Cache-Invalidierung
      this.userByIdCache.delete(uid);
    });
  }

  /**
   * Löscht den Observable-Cache (TIER 1, Fix 2)
   */
  clearCache(): void {
    this.usersCache$ = undefined;
    this.userByIdCache.clear();
  }

  private normalizeAvatar(raw?: string): string {
    if (!raw) return 'assets/img-profile/profile.png';
    if (/^https?:\/\//i.test(raw)) return raw;
    const clean = raw.replace(/^\/+/, '');
    return clean.startsWith('assets/') ? clean : `assets/${clean}`;
  }
}
