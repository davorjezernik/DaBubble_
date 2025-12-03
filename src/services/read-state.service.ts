import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
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

  private optim$ = new Map<string, BehaviorSubject<Timestamp>>();

  private bumpMap = new Map<string, BehaviorSubject<number>>();

  private unreadChannelCache = new Map<string, Observable<number>>();
  private unreadDmCache = new Map<string, Observable<number>>();

  /**
   * Executes a function within a valid injection context to prevent AngularFire warnings.
   * @param fn The function to execute.
   * @returns The result of the function execution.
   */
  private withCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.env, fn);
  }

  /**
   * Wraps docData with a valid injection context.
   * @param ref The document reference.
   * @returns An observable of the document data.
   */
  private docData$<T>(ref: any): Observable<T> {
    return this.withCtx(() => docData(ref) as Observable<T>);
  }

  /**
   * Wraps collectionData with a valid injection context.
   * @param q The query.
   * @param options The options.
   * @returns An observable of the collection data.
   */
  private collectionData$<T>(q: any, options?: any): Observable<T[]> {
    return this.withCtx(() => collectionData(q, options) as Observable<T[]>);
  }

  /**
   * Generates a key for maps based on thread ID and user ID.
   * @param threadId The thread ID.
   * @param uid The user ID.
   * @returns The generated key.
   */
  private key(threadId: string, uid: string) {
    return `${threadId}|${uid}`;
  }

  /**
   * Gets or creates an optimistic Timestamp Subject instance.
   * @param threadId The thread ID.
   * @param uid The user ID.
   * @returns The optimistic Timestamp Subject.
   */
  private getOptimistic$(threadId: string, uid: string) {
    const k = this.key(threadId, uid);
    if (!this.optim$.has(k)) {
      this.optim$.set(k, new BehaviorSubject<Timestamp>(Timestamp.fromMillis(0)));
    }
    return this.optim$.get(k)!;
  }

  /**
   * Gets or creates a last message Bump Subject instance.
   * @param threadId The thread ID.
   * @returns The last message Bump Subject.
   */
  private getLastBump$(threadId: string) {
    if (!this.bumpMap.has(threadId)) {
      this.bumpMap.set(threadId, new BehaviorSubject<number>(0));
    }
    return this.bumpMap.get(threadId)!;
  }

  /**
   * Gets the read document reference for a DM.
   * @param dmId The DM ID.
   * @param uid The user ID.
   * @returns The document reference.
   */
  private readDoc(dmId: string, uid: string) {
    return doc(this.firestore, `dms/${dmId}/reads/${uid}`);
  }

  /**
   * Bumps the last message timestamp for a DM on the client side.
   * @param dmId The DM ID.
   */
  bumpLastMessage(dmId: string) {
    this.getLastBump$(dmId).next(Date.now());
  }

  /**
   * Marks a DM as read.
   * @param dmId The DM ID.
   * @param uid The user ID.
   */
  async markDmRead(dmId: string, uid: string) {
    this.getOptimistic$(dmId, uid).next(Timestamp.now());

    const ref = this.readDoc(dmId, uid);
    await setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
  }

  /**
   * Gets the number of unread DM messages from other authors.
   * @param dmId The DM ID.
   * @param uid The user ID.
   * @returns An observable of the number of unread messages.
   */
  unreadDmCount$(dmId: string, uid: string): Observable<number> {
    const cacheKey = this.key(dmId, uid);

    if (this.unreadDmCache.has(cacheKey)) {
      return this.unreadDmCache.get(cacheKey)!;
    }

    const unread$ = this.buildUnreadStream(dmId, uid);

    this.unreadDmCache.set(cacheKey, unread$);
    return unread$;
  }

  /**
   * Builds the unread stream for a DM.
   * @param dmId The DM ID.
   * @param uid The user ID.
   * @returns An observable of the number of unread messages.
   */
  private buildUnreadStream(dmId: string, uid: string): Observable<number> {
    const fs$ = this.getFirestoreRead$(dmId, uid);
    const opt$ = this.getOptimistic$(dmId, uid);

    return combineLatest([fs$, opt$]).pipe(
      switchMap(([read, opt]) => this.queryUnreadMessages(dmId, read, opt)),
      map((msgs) => this.countMsgsNotByUser(msgs, uid)),
      auditTime(300),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(() => of(0))
    );
  }

  /**
   * Counts messages not authored by the user.
   * @param msgs The messages.
   * @param uid The user ID.
   * @returns The count of messages.
   */
  private countMsgsNotByUser(msgs: any[], uid: string): number {
    return msgs.filter((m) => m?.authorId !== uid).length;
  }

  /**
   * Gets the Firestore read document for a DM.
   * @param dmId The DM ID.
   * @param uid The user ID.
   * @returns An observable of the read document.
   */
  private getFirestoreRead$(dmId: string, uid: string): Observable<ReadDoc | null> {
    const myReadRef = this.readDoc(dmId, uid);
    return this.docData$<ReadDoc>(myReadRef);
  }

  /**
   * Queries unread messages for a DM.
   * @param dmId The DM ID.
   * @param read The read document.
   * @param opt The optimistic timestamp.
   * @returns An observable of the unread messages.
   */
  private queryUnreadMessages(
    dmId: string,
    read: ReadDoc | null,
    opt: Timestamp
  ): Observable<any[]> {
    const since = this.resolveSinceTimestamp(read, opt);

    const messagesRef = collection(
      this.firestore,
      `dms/${dmId}/messages`
    ) as CollectionReference<any>;

    const qy = query(
      messagesRef,
      where('timestamp', '>', since),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return this.collectionData$<any>(qy, { idField: 'id' });
  }

  /**
   * Resolves the timestamp to query messages since.
   * @param read The read document.
   * @param opt The optimistic timestamp.
   * @returns The resolved timestamp.
   */
  private resolveSinceTimestamp(read: ReadDoc | null, opt: Timestamp): Timestamp {
    const fsSince =
      read?.lastReadAt instanceof Timestamp ? read.lastReadAt : Timestamp.fromMillis(0);

    return fsSince.toMillis() > opt.toMillis() ? fsSince : opt;
  }

  /**
   * Gets the last message time from Firestore for a DM.
   * @param dmId The DM ID.
   * @returns An observable of the last message time in milliseconds.
   */
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

  /**
   * Gets the last message time for a DM, including optimistic bumps.
   * @param dmId The DM ID.
   * @returns An observable of the last message time in milliseconds.
   */
  lastMessageAt$(dmId: string): Observable<number> {
    return combineLatest([this.lastMessageAtFs$(dmId), this.getLastBump$(dmId)]).pipe(
      map(([fsMillis, bumpMillis]) => Math.max(fsMillis, bumpMillis))
    );
  }

  /**
   * Gets combined metadata for a DM (unread count and last message time).
   * @param dmId The DM ID.
   * @param uid The user ID.
   * @returns An observable of the DM metadata.
   */
  dmMeta$(
    dmId: string,
    uid: string
  ): Observable<{
    unread: number;
    lastMessageAt: number;
  }> {
    return combineLatest([this.unreadDmCount$(dmId, uid), this.lastMessageAt$(dmId)]).pipe(
      map(([unread, lastMessageAt]) => ({
        unread,
        lastMessageAt,
      }))
    );
  }

  /**
   * Gets the message collection reference for DMs or channels.
   * @param kind The kind of collection ('dms' or 'channels').
   * @param id The ID of the DM or channel.
   * @returns The collection reference.
   */
  private msgsRef(kind: 'dms' | 'channels', id: string): CollectionReference<any> {
    return collection(this.firestore, `${kind}/${id}/messages`) as CollectionReference<any>;
  }

  /**
   * Gets the read document reference for DMs or channels.
   * @param kind The kind of collection ('dms' or 'channels').
   * @param id The ID of the DM or channel.
   * @param uid The user ID.
   * @returns The document reference.
   */
  private readDocGeneric(kind: 'dms' | 'channels', id: string, uid: string) {
    return doc(this.firestore, `${kind}/${id}/reads/${uid}`);
  }

  /**
   * Marks a channel as read.
   * @param channelId The channel ID.
   * @param uid The user ID.
   * @returns A promise that resolves when the operation is complete.
   */
  markChannelRead(channelId: string, uid: string) {
    this.getOptimistic$(channelId, uid).next(Timestamp.now());
    const ref = this.readDocGeneric('channels', channelId, uid);
    return setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
  }

  /**
   * Gets the number of unread channel messages from other authors.
   * @param channelId The channel ID.
   * @param uid The user ID.
   * @returns An observable of the number of unread messages.
   */
  unreadChannelCount$(channelId: string, uid: string): Observable<number> {
    const cacheKey = this.key(channelId, uid);

    if (this.unreadChannelCache.has(cacheKey)) {
      return this.unreadChannelCache.get(cacheKey)!;
    }

    const unread$ = this.buildUnreadChannelStream(channelId, uid);

    this.unreadChannelCache.set(cacheKey, unread$);
    return unread$;
  }

  /**
   * Builds the unread stream for a channel.
   * @param channelId The channel ID.
   * @param uid The user ID.
   * @returns An observable of the number of unread messages.
   */
  private buildUnreadChannelStream(channelId: string, uid: string): Observable<number> {
    const fs$ = this.getChannelReadDoc$(channelId, uid);
    const opt$ = this.getOptimistic$(channelId, uid);

    return combineLatest([fs$, opt$]).pipe(
      switchMap(([read, opt]) => this.queryUnreadChannelMessages(channelId, read, opt)),
      map((msgs) => this.countUnreadMessages(msgs, uid)),
      auditTime(300),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(() => of(0))
    );
  }

  /**
   * Gets the Firestore read document for a channel.
   * @param channelId The channel ID.
   * @param uid The user ID.
   * @returns An observable of the read document.
   */
  private getChannelReadDoc$(channelId: string, uid: string): Observable<ReadDoc | null> {
    const ref = this.readDocGeneric('channels', channelId, uid);
    return this.docData$<ReadDoc>(ref);
  }

  /**
   * Queries unread messages for a channel.
   * @param channelId The channel ID.
   * @param read The read document.
   * @param opt The optimistic timestamp.
   * @returns An observable of the unread messages.
   */
  private queryUnreadChannelMessages(
    channelId: string,
    read: ReadDoc | null,
    opt: Timestamp
  ): Observable<any[]> {
    const since = this.resolveSinceTimestamp(read, opt);

    const qy = query(
      this.msgsRef('channels', channelId),
      where('timestamp', '>', since),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return this.collectionData$<any>(qy);
  }

  /**
   * Counts unread messages not authored by the user.
   * @param msgs The messages.
   * @param uid The user ID.
   * @returns The count of messages.
   */
  private countUnreadMessages(msgs: any[], uid: string): number {
    return msgs.filter((m) => m?.authorId !== uid).length;
  }

  /**
   * Bumps the last channel message timestamp on the client side.
   * @param channelId The channel ID.
   */
  bumpLastChannelMessage(channelId: string) {
    this.getLastBump$(channelId).next(Date.now());
  }

  /**
   * Gets the last channel message time from Firestore.
   * @param channelId The channel ID.
   * @returns An observable of the last message time in milliseconds.
   */
  private lastChannelMessageAtFs$(channelId: string): Observable<number> {
    const qy = query(this.msgsRef('channels', channelId), orderBy('timestamp', 'desc'), limit(1));

    return this.collectionData$<any>(qy).pipe(
      map((rows) => {
        const ts = rows?.[0]?.timestamp;
        return ts instanceof Timestamp ? ts.toMillis() : 0;
      })
    );
  }

  /**
   * Gets the last channel message time, including optimistic bumps.
   * @param channelId The channel ID.
   * @returns An observable of the last message time in milliseconds.
   */
  lastChannelMessageAt$(channelId: string): Observable<number> {
    return combineLatest([
      this.lastChannelMessageAtFs$(channelId),
      this.getLastBump$(channelId),
    ]).pipe(map(([fsMillis, bump]) => Math.max(fsMillis, bump)));
  }

  /**
   * Gets combined metadata for a channel (unread count and last message time).
   * @param channelId The channel ID.
   * @param uid The user ID.
   * @returns An observable of the channel metadata.
   */
  channelMeta$(
    channelId: string,
    uid: string
  ): Observable<{
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
   * Clears the observable cache for unread counts.
   */
  clearCache(): void {
    this.unreadChannelCache.clear();
    this.unreadDmCache.clear();
  }
}
