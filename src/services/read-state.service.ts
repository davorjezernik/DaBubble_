import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  serverTimestamp,
  docData,
  collection,
  query,
  where,
  orderBy,
  Timestamp,
  CollectionReference,
  collectionData,
  limit,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, combineLatest, map, switchMap } from 'rxjs';

type ReadDoc = { lastReadAt?: Timestamp } | undefined;

@Injectable({ providedIn: 'root' })
export class ReadStateService {
  private firestore = inject(Firestore);

  private optim$ = new Map<string, BehaviorSubject<Timestamp>>();

  private key(dmId: string, uid: string) {
    return `${dmId}|${uid}`;
  }

  private getOptimistic$(dmId: string, uid: string) {
    const k = this.key(dmId, uid);
    if (!this.optim$.has(k))
      this.optim$.set(k, new BehaviorSubject<Timestamp>(Timestamp.fromMillis(0)));
    return this.optim$.get(k)!;
  }

  private bumpMap = new Map<string, BehaviorSubject<number>>();
  private getLastBump$(dmId: string) {
    if (!this.bumpMap.has(dmId)) this.bumpMap.set(dmId, new BehaviorSubject<number>(0));
    return this.bumpMap.get(dmId)!;
  }

  bumpLastMessage(dmId: string) {
    this.getLastBump$(dmId).next(Date.now());
  }

  readDoc(dmId: string, uid: string) {
    return doc(this.firestore, `dms/${dmId}/reads/${uid}`);
  }

  async markDmRead(dmId: string, uid: string) {
    // 1) sofort lokal auf "jetzt" setzen (verhindert Blink)
    this.getOptimistic$(dmId, uid).next(Timestamp.now());
    // 2) Firestore persistieren
    const ref = this.readDoc(dmId, uid);
    await setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
  }

  unreadDmCount$(dmId: string, uid: string): Observable<number> {
    const myReadRef = this.readDoc(dmId, uid);
    const fs$ = docData(myReadRef) as Observable<ReadDoc>;
    const opt$ = this.getOptimistic$(dmId, uid);

    return combineLatest([fs$, opt$]).pipe(
      switchMap(([read, opt]) => {
        // since = max(Firestore, Optimistic)
        const fsSince =
          read?.lastReadAt instanceof Timestamp ? read.lastReadAt : Timestamp.fromMillis(0);
        const since = fsSince.toMillis() > opt.toMillis() ? fsSince : opt;

        const messagesRef = collection(
          this.firestore,
          `dms/${dmId}/messages`
        ) as CollectionReference<any>;
        const q = query(messagesRef, where('timestamp', '>', since), orderBy('timestamp', 'asc'));
        return collectionData(q, { idField: 'id' }) as Observable<any[]>;
      }),
      map((msgs) => msgs.filter((m) => m?.authorId !== uid).length)
    );
  }

  /** Firestore-basierter letzter Nachrichtenzeitpunkt (Millis) */
  private lastMessageAtFs$(dmId: string): Observable<number> {
    const messagesRef = collection(
      this.firestore,
      `dms/${dmId}/messages`
    ) as CollectionReference<any>;

    // neueste Nachricht holen (1 Stück)
    const qy = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

    return collectionData(qy).pipe(
      map((rows: any[]) => {
        const ts = rows?.[0]?.timestamp;
        return ts instanceof Timestamp ? ts.toMillis() : 0;
      })
    );
  }

  // Kombi-Meta für Sortierung
  lastMessageAt$(dmId: string): Observable<number> {
    return combineLatest([this.lastMessageAtFs$(dmId), this.getLastBump$(dmId)]).pipe(
      map(([fsMillis, bumpMillis]) => Math.max(fsMillis, bumpMillis))
    );
  }

  dmMeta$(dmId: string, uid: string): Observable<{ unread: number; lastMessageAt: number }> {
    return combineLatest([this.unreadDmCount$(dmId, uid), this.lastMessageAt$(dmId)]).pipe(
      map(([unread, lastMessageAt]) => ({ unread, lastMessageAt }))
    );
  }

  private msgsRef(kind: 'dms'|'channels', id: string) {
  return collection(this.firestore, `${kind}/${id}/messages`) as CollectionReference<any>;
}
private readDocGeneric(kind: 'dms'|'channels', id: string, uid: string) {
  return doc(this.firestore, `${kind}/${id}/reads/${uid}`);
}

// ---- CHANNEL: Read markieren ----
markChannelRead(channelId: string, uid: string) {
  // optimistisch (gegen Blink)
  this.getOptimistic$(channelId, uid).next(Timestamp.now());
  const ref = this.readDocGeneric('channels', channelId, uid);
  return setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
}

// ---- CHANNEL: Unread zählen ----
unreadChannelCount$(channelId: string, uid: string): Observable<number> {
  const fs$ = docData(this.readDocGeneric('channels', channelId, uid)) as Observable<ReadDoc>;
  const opt$ = this.getOptimistic$(channelId, uid);
  return combineLatest([fs$, opt$]).pipe(
    switchMap(([read, opt]) => {
      const fsSince = read?.lastReadAt instanceof Timestamp ? read.lastReadAt : Timestamp.fromMillis(0);
      const since = fsSince.toMillis() > opt.toMillis() ? fsSince : opt;
      const qy = query(this.msgsRef('channels', channelId), where('timestamp','>',since), orderBy('timestamp','asc'));
      return collectionData(qy) as Observable<any[]>;
    }),
    map(msgs => msgs.filter(m => m?.authorId !== uid).length)
  );
}

// ---- CHANNEL: letzte Nachricht (optimistisch) ----
bumpLastChannelMessage(channelId: string) {
  this.getLastBump$(channelId).next(Date.now());
}
private lastChannelMessageAtFs$(channelId: string): Observable<number> {
  const qy = query(this.msgsRef('channels', channelId), orderBy('timestamp','desc'), limit(1));
  return collectionData(qy).pipe(map((rows:any[]) => {
    const ts = rows?.[0]?.timestamp;
    return ts instanceof Timestamp ? ts.toMillis() : 0;
  }));
}
lastChannelMessageAt$(channelId: string): Observable<number> {
  return combineLatest([ this.lastChannelMessageAtFs$(channelId), this.getLastBump$(channelId) ])
    .pipe(map(([fsMillis,bump]) => Math.max(fsMillis, bump)));
}

// ---- CHANNEL: Kombi-Meta (für Sortierung) ----
channelMeta$(channelId: string, uid: string): Observable<{ unread: number; lastMessageAt: number }> {
  return combineLatest([
    this.unreadChannelCount$(channelId, uid),
    this.lastChannelMessageAt$(channelId),
  ]).pipe(map(([unread, lastMessageAt]) => ({ unread, lastMessageAt })));
}
}
