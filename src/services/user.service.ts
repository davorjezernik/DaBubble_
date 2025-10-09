import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { User } from '../models/user.class';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private firestore: Firestore) {}

  users$(): Observable<User[]> {
    const ref = collection(this.firestore, 'users');
    const q = query(ref, orderBy('name'));
    return collectionData(q, { idField: 'uid' }).pipe(
      map((docs: any[]) =>
        docs
          .map(
            (d) =>
              new User({
                ...d,
                avatar: d.avatar?.startsWith('/') ? d.avatar : `/${d.avatar}`,
                online: !!d.online,
              })
          )
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      )
    );
  }
}
