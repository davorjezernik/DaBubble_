import {
  Injectable,
  inject,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
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
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
  switchMap,
  shareReplay,
  auditTime,
  catchError,
  of,
} from 'rxjs';

type ReadDoc = { lastReadAt?: Timestamp } | undefined;

@Injectable({ providedIn: 'root' })
export class ReadStateService {
  private firestore = inject(Firestore);
  private env = inject(EnvironmentInjector);

  // lastRead values per thread+user //
  private optim$ = new Map<string, BehaviorSubject<Timestamp>>();

  // Last message bumps per thread //
  private bumpMap = new Map<string, BehaviorSubject<number>>();

  // Observable Caching (TIER 2, Fix 5a)
  private unreadChannelCache = new Map<string, Observable<number>>();
  private unreadDmCache = new Map<string, Observable<number>>();

  // Executes fn in a valid injection context against AngularFire warnings //
  private withCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.env, fn);
  }

  // Wrapper around docData with a valid injection context //
  private docData$<T>(ref: any): Observable<T> {
    return this.withCtx(() => docData(ref) as Observable<T>);
  }

  // Wrapper around collectionData with a valid injection context //
  private collectionData$<T>(q: any, options?: any): Observable<T[]> {
    return this.withCtx(
      () => collectionData(q, options) as Observable<T[]>
    );
  }

  // Key for maps: threadId|uid reused for DMs & channels //
  private key(threadId: string, uid: string) {
    return `${threadId}|${uid}`;
  }

  // Get/create optimistic Timestamp Subject instance //
  private getOptimistic$(threadId: string, uid: string) {
    const k = this.key(threadId, uid);
    if (!this.optim$.has(k)) {
      this.optim$.set(k, new BehaviorSubject<Timestamp>(Timestamp.fromMillis(0)));
    }
    return this.optim$.get(k)!;
  }

  // Get/create last message Bump Subject instance //
  private getLastBump$(threadId: string) {
    if (!this.bumpMap.has(threadId)) {
      this.bumpMap.set(threadId, new BehaviorSubject<number>(0));
    }
    return this.bumpMap.get(threadId)!;
  }

  // DMs

  private readDoc(dmId: string, uid: string) {
    return doc(this.firestore, `dms/${dmId}/reads/${uid}`);
  }

  // Client-side bump for new DM message sorting //
  bumpLastMessage(dmId: string) {
    this.getLastBump$(dmId).next(Date.now());
  }

  // Mark DM as read //
  async markDmRead(dmId: string, uid: string) {
    this.getOptimistic$(dmId, uid).next(Timestamp.now());

    const ref = this.readDoc(dmId, uid);
    await setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
  }

  /**
   * Number of unread DM messages from other authors
   * Mit Observable Caching, limit(100) und auditTime (TIER 2, Fix 5)
   */
  unreadDmCount$(dmId: string, uid: string): Observable<number> {
    const cacheKey = this.key(dmId, uid);

    if (this.unreadDmCache.has(cacheKey)) {
      return this.unreadDmCache.get(cacheKey)!;
    }

    const myReadRef = this.readDoc(dmId, uid);
    const fs$ = this.docData$<ReadDoc>(myReadRef);
    const opt$ = this.getOptimistic$(dmId, uid);

    const unread$ = combineLatest([fs$, opt$]).pipe(
      switchMap(([read, opt]) => {
        const fsSince =
          read?.lastReadAt instanceof Timestamp
            ? read.lastReadAt
            : Timestamp.fromMillis(0);
        const since = fsSince.toMillis() > opt.toMillis() ? fsSince : opt;

        const messagesRef = collection(
          this.firestore,
          `dms/${dmId}/messages`
        ) as CollectionReference<any>;

        const qy = query(
          messagesRef,
          where('timestamp', '>', since),
          orderBy('timestamp', 'asc'),
          limit(100) // ← Limit 100 unread messages (TIER 2, Fix 5b)
        );

        return this.collectionData$<any>(qy, { idField: 'id' });
      }),
      map((msgs) => msgs.filter((m) => m?.authorId !== uid).length),
      auditTime(300), // ← Nur alle 300ms aktualisieren (TIER 2, Fix 5b)
      shareReplay({ bufferSize: 1, refCount: true }), // ← Caching (TIER 2, Fix 5a)
      catchError(() => of(0))
    );

    this.unreadDmCache.set(cacheKey, unread$);
    return unread$;
  }

  // Last message time from Firestore //
  private lastMessageAtFs$(dmId: string): Observable<number> {
    const messagesRef = collection(
      this.firestore,
      `dms/${dmId}/messages`
    ) as CollectionReference<any>;

    const qy = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

    return this.collectionData$<any>(qy).pipe(
      map((rows) => {
        const ts = rows?.[0]?.timestamp;
        return ts instanceof Timestamp ? ts.toMillis() : 0;
      })
    );
  }

  // Last news update including optimistic bump //
  lastMessageAt$(dmId: string): Observable<number> {
    return combineLatest([
      this.lastMessageAtFs$(dmId),
      this.getLastBump$(dmId),
    ]).pipe(map(([fsMillis, bumpMillis]) => Math.max(fsMillis, bumpMillis)));
  }

  // Combined meta for DMs Unread + last timestamp for sorting //
  dmMeta$(dmId: string, uid: string): Observable<{
    unread: number;
    lastMessageAt: number;
  }> {
    return combineLatest([
      this.unreadDmCount$(dmId, uid),
      this.lastMessageAt$(dmId),
    ]).pipe(
      map(([unread, lastMessageAt]) => ({
        unread,
        lastMessageAt,
      }))
    );
  }

  // Channels
  
  // Message collection for DMs/Channels //
  private msgsRef(
    kind: 'dms' | 'channels',
    id: string
  ): CollectionReference<any> {
    return collection(
      this.firestore,
      `${kind}/${id}/messages`
    ) as CollectionReference<any>;
  }

  private readDocGeneric(
    kind: 'dms' | 'channels',
    id: string,
    uid: string
  ) {
    return doc(this.firestore, `${kind}/${id}/reads/${uid}`);
  }

  // Mark channel as read //
  markChannelRead(channelId: string, uid: string) {
    this.getOptimistic$(channelId, uid).next(Timestamp.now());
    const ref = this.readDocGeneric('channels', channelId, uid);
    return setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
  }

  /**
   * Number of unread channel messages from other authors
   * Mit Observable Caching, limit(100) und auditTime (TIER 2, Fix 5)
   */
  unreadChannelCount$(channelId: string, uid: string): Observable<number> {
    const cacheKey = this.key(channelId, uid);

    if (this.unreadChannelCache.has(cacheKey)) {
      return this.unreadChannelCache.get(cacheKey)!;
    }

    const fs$ = this.docData$<ReadDoc>(
      this.readDocGeneric('channels', channelId, uid)
    );
    const opt$ = this.getOptimistic$(channelId, uid);

    const unread$ = combineLatest([fs$, opt$]).pipe(
      switchMap(([read, opt]) => {
        const fsSince =
          read?.lastReadAt instanceof Timestamp
            ? read.lastReadAt
            : Timestamp.fromMillis(0);
        const since = fsSince.toMillis() > opt.toMillis() ? fsSince : opt;

        const qy = query(
          this.msgsRef('channels', channelId),
          where('timestamp', '>', since),
          orderBy('timestamp', 'asc'),
          limit(100) // ← Limit 100 unread messages (TIER 2, Fix 5b)
        );

        return this.collectionData$<any>(qy);
      }),
      map((msgs) => msgs.filter((m) => m?.authorId !== uid).length),
      auditTime(300), // ← Nur alle 300ms aktualisieren (TIER 2, Fix 5b)
      shareReplay({ bufferSize: 1, refCount: true }), // ← Caching (TIER 2, Fix 5a)
      catchError(() => of(0))
    );

    this.unreadChannelCache.set(cacheKey, unread$);
    return unread$;
  }

  // Client-side bump upon new channel message //
  bumpLastChannelMessage(channelId: string) {
    this.getLastBump$(channelId).next(Date.now());
  }

  // Last channel message time from Firestore //
  private lastChannelMessageAtFs$(
    channelId: string
  ): Observable<number> {
    const qy = query(
      this.msgsRef('channels', channelId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    return this.collectionData$<any>(qy).pipe(
      map((rows) => {
        const ts = rows?.[0]?.timestamp;
        return ts instanceof Timestamp ? ts.toMillis() : 0;
      })
    );
  }

  // Last channel message time including bump //
  lastChannelMessageAt$(channelId: string): Observable<number> {
    return combineLatest([
      this.lastChannelMessageAtFs$(channelId),
      this.getLastBump$(channelId),
    ]).pipe(map(([fsMillis, bump]) => Math.max(fsMillis, bump)));
  }

  // for sorting channels (unread + last timestamp) //
  channelMeta$(channelId: string, uid: string): Observable<{
    unread: number;
    lastMessageAt: number;
  }> {
    return combineLatest([
      this.unreadChannelCount$(channelId, uid),
      this.lastChannelMessageAt$(channelId),
    ]).pipe(
      map(([unread, lastMessageAt]) => ({
        unread,
        lastMessageAt,
      }))
    );
  }

  /**
   * Löscht den Observable-Cache für Unread Counts (TIER 2, Fix 5a)
   */
  clearCache(): void {
    this.unreadChannelCache.clear();
    this.unreadDmCache.clear();
  }
}
