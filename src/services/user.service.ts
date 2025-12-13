import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
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
import { Auth, authState, updateProfile } from '@angular/fire/auth';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError, shareReplay } from 'rxjs/operators';
import { User } from '../models/user.class';

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(EnvironmentInjector);
  private usersCache$?: Observable<User[]>;
  private userByIdCache = new Map<string, Observable<User | null>>();

  /**
   * Marks the current user as online or offline.
   * @param online Whether the user is online.
   * @returns A promise that resolves when the operation is complete.
   */
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

  /**
   * Gets a sorted list of all users.
   * @returns An observable of the list of users.
   */
  users$(): Observable<User[]> {
    if (!this.usersCache$) {
      this.usersCache$ = runInInjectionContext(this.injector, () => {
        const ref = collection(this.firestore, 'users');
        const q = query(ref, orderBy('name'));
        return this.getSortedUsers(q);
      });
    }
    return this.usersCache$;
  }

  /**
   * Gets sorted users from a query.
   * @param q The query.
   * @returns An observable of the sorted users.
   */
  private getSortedUsers(q: any) {
    return collectionData(q, { idField: 'uid' }).pipe(
      map((docs: any[]) => this.processUserDocs(docs)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /**
   * Processes user documents.
   * @param docs The user documents.
   * @returns The processed user objects.
   */
  private processUserDocs(docs: any[]) {
    return docs
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
        String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, {
          sensitivity: 'base',
        })
      );
  }

  /**
   * Gets a user by their ID.
   * @param uid The user ID.
   * @returns An observable of the user or null.
   */
  userById$(uid: string): Observable<User | null> {
    if (!this.userByIdCache.has(uid)) {
      const user$ = runInInjectionContext(this.injector, () => {
        const ref = doc(this.firestore, 'users', uid);
        return this.getUser(ref);
      });
      this.userByIdCache.set(uid, user$);
    }
    return this.userByIdCache.get(uid)!;
  }

  /**
   * Gets a user from a document reference.
   * @param ref The document reference.
   * @returns An observable of the user or null.
   */
  private getUser(ref: any) {
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
  }

  /**
   * Gets the current user.
   * @returns An observable of the current user or null.
   */
  currentUser$(): Observable<User | null> {
    return runInInjectionContext(this.injector, () =>
      authState(this.auth).pipe(switchMap((u) => this.resolveCurrentUser(u)))
    );
  }

  /**
   * Resolves the current user from the auth user.
   * @param u The auth user.
   * @returns An observable of the user or null.
   */
  private resolveCurrentUser(u: any) {
    if (!u) return of(null);
    return this.loadOrCreateProfileUser(u);
  }

  /**
   * Loads or creates a profile user.
   * @param u The auth user.
   * @returns An observable of the user.
   */
  private loadOrCreateProfileUser(u: any) {
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
  }

  /**
   * Updates the user's name.
   * @param uid The user ID.
   * @param name The new name.
   * @returns A promise that resolves when the operation is complete.
   */
  async updateUserName(uid: string, name: string) {
    const newName = String(name ?? '').trim();

    return runInInjectionContext(this.injector, async () => {
      const userRef = doc(this.firestore, `users/${uid}`);
      await updateDoc(userRef, { name: newName });

      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, { displayName: newName });
      }

      this.userByIdCache.delete(uid);
    });
  }

  /**
   * Updates a user's avatar (photoURL) in Firestore and the auth profile.
   * @param uid The user ID to update.
   * @param avatar The avatar path or URL.
   */
  async updateUserAvatar(uid: string, avatar: string) {
    const avatarVal = String(avatar ?? '').trim();

    return runInInjectionContext(this.injector, async () => {
      try {
        const userRef = doc(this.firestore, `users/${uid}`);
        await updateDoc(userRef, { avatar: avatarVal });

        if (this.auth.currentUser) {
          await updateProfile(this.auth.currentUser, { photoURL: avatarVal });
        }

        this.userByIdCache.delete(uid);
      } catch (e) {
        console.warn('updateUserAvatar failed', e);
      }
    });
  }

  /**
   * Updates the user's recent emojis list.
   * Adds the emoji to the front, removes duplicates, and keeps max 2 emojis.
   * @param userId The user ID.
   * @param emoji The emoji unicode string to add.
   * @returns A promise that resolves when the operation is complete.
   */
  async updateRecentEmojis(userId: string, emoji: string): Promise<void> {
    if (!userId || !emoji) return;

    return runInInjectionContext(this.injector, async () => {
      try {
        const userRef = doc(this.firestore, 'users', userId);
        const userDoc = await firstValueFrom(
          this.userById$(userId).pipe(
            map(user => user),
            catchError(() => of(null))
          )
        );
        const currentEmojis = userDoc?.recentEmojis ?? [];
        const filtered = currentEmojis.filter(e => e !== emoji);
        const updated = [emoji, ...filtered].slice(0, 2);
        await updateDoc(userRef, { recentEmojis: updated });
        this.userByIdCache.delete(userId);
      } catch (e) {
        console.warn('updateRecentEmojis failed', e);
      }
    });
  }

  /**
   * Clears the observable cache.
   */
  clearCache(): void {
    this.usersCache$ = undefined;
    this.userByIdCache.clear();
  }

  /**
   * Normalizes the avatar URL.
   * @param raw The raw avatar URL.
   * @returns The normalized avatar URL.
   */
  private normalizeAvatar(raw?: string): string {
    if (!raw) return 'assets/img-profile/profile.png';
    if (/^https?:\/\//i.test(raw)) return raw;
    const clean = raw.replace(/^\/+/, '');
    return clean.startsWith('assets/') ? clean : `assets/${clean}`;
  }
}
