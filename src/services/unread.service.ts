import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  collection,
  collectionData,
  query,
  orderBy,
  where,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable, switchMap, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UnreadService {
  private firestore = inject(Firestore);

  unreadCount$(
    collectionName: 'channels' | 'dms',
    threadId: string,
    uid: string
  ): Observable<number> {
    const threadRef = doc(this.firestore, `${collectionName}/${threadId}`);

    const lastRead$ = docData(threadRef).pipe(
      map((d: any) => (d?.['lastReads']?.[uid] as Timestamp | undefined) ?? new Timestamp(0, 0))
    );

    return lastRead$.pipe(
      switchMap((lastRead) => {
        const msgsRef = collection(this.firestore, `${collectionName}/${threadId}/messages`);
        const q = query(msgsRef, orderBy('timestamp'), where('timestamp', '>', lastRead));
        return collectionData(q, { idField: 'id' }).pipe(
          map((msgs: any[]) => msgs.filter((m) => m.authorId !== uid).length)
        );
      })
    );
  }
}
