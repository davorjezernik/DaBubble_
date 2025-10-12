import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, collection, collectionData, query, orderBy } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of, switchMap, map, catchError } from 'rxjs';
import { User } from '../models/user.class';

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  users$(): Observable<User[]> {
    const ref = collection(this.firestore, 'users');
    const q   = query(ref, orderBy('name'));
    return collectionData(q, { idField: 'uid' }).pipe(
      map((docs: any[]) =>
        docs
          .map(d => new User({
            ...d,
            avatar: this.normalizeAvatar(d.avatar),
            online: !!d.online
          }))
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      )
    );
  }

  userById$(uid: string): Observable<User | null> {
    const ref = doc(this.firestore, 'users', uid);
    return docData(ref, { idField: 'uid' }).pipe(
      map((d: any | undefined) => d ? new User({
        ...d,
        avatar: this.normalizeAvatar(d.avatar),
        online: !!d.online
      }) : null),
      catchError(() => of(null))
    );
  }

  currentUser$(): Observable<User | null> {
    return authState(this.auth).pipe(
      switchMap(u => {
        if (!u) return of(null);
        return this.userById$(u.uid).pipe(
          map(profile => profile ?? new User({
            uid: u.uid,
            name: u.displayName || u.email || 'Unbekannt',
            email: u.email || '',
            avatar: this.normalizeAvatar(u.photoURL || ''),
            online: true
          }))
        );
      })
    );
  }

  private normalizeAvatar(raw?: string): string {
  if (!raw) return 'assets/img-profile/profile.png';
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, '');
  return clean.startsWith('assets/') ? clean : `assets/${clean}`;
}
}