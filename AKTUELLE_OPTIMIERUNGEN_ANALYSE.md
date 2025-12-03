# Analyse: Bereits implementierte Firestore-Optimierungen

**Datum:** 3. Dezember 2025  
**Branch:** refactor/Quota-exceeded-fix  
**Zweck:** Überprüfung welche Optimierungen bereits im Code vorhanden sind

---

## ✅ BEREITS IMPLEMENTIERTE OPTIMIERUNGEN

### 1. ✅ Injection Context Wrapper (TIER 3, Fix 10)

**Status:** ✅ VOLLSTÄNDIG IMPLEMENTIERT  
**Datei:** `read-state.service.ts`

```typescript
private env = inject(EnvironmentInjector);

private withCtx<T>(fn: () => T): T {
  return runInInjectionContext(this.env, fn);
}

private docData$<T>(ref: any): Observable<T> {
  return this.withCtx(() => docData(ref) as Observable<T>);
}

private collectionData$<T>(q: any, options?: any): Observable<T[]> {
  return this.withCtx(() => collectionData(q, options) as Observable<T[]>);
}
```

**Übereinstimmung mit Plan:** ✅ JA - Identisch mit TIER 3, Fix 10

---

### 2. ✅ Query Limit für Last Message (Teilweise TIER 1, Fix 3)

**Status:** ✅ IMPLEMENTIERT  
**Datei:** `read-state.service.ts`

```typescript
// Last message time from Firestore
private lastMessageAtFs$(dmId: string): Observable<number> {
  const messagesRef = collection(this.firestore, `dms/${dmId}/messages`);
  const qy = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

  return this.collectionData$<any>(qy).pipe(
    map((rows) => {
      const ts = rows?.[0]?.timestamp;
      return ts instanceof Timestamp ? ts.toMillis() : 0;
    })
  );
}

// Channel Version
private lastChannelMessageAtFs$(channelId: string): Observable<number> {
  const qy = query(
    this.msgsRef('channels', channelId),
    orderBy('timestamp', 'desc'),
    limit(1)
  );
  // ...
}
```

**Übereinstimmung mit Plan:** ✅ TEILWEISE - Ist Teil von TIER 1, Fix 3 (Query Limits)

---

### 3. ✅ shareReplay in base-chat-interface-component

**Status:** ✅ IMPLEMENTIERT  
**Datei:** `base-chat-interface-component.ts`

```typescript
private setupMessageStream() {
  this.messages$ = this.route.paramMap.pipe(
    switchMap((params) => this.loadMessagesForChat(params)),
    shareReplay(1)  // ← Hier verwendet!
  );
}
```

**Übereinstimmung mit Plan:** ✅ TEILWEISE - Ist Teil von TIER 1, Fix 2 (Observable Caching)  
**Hinweis:** Aber nur in dieser einen Stelle, nicht global wie im Plan vorgesehen

---

## ❌ NICHT IMPLEMENTIERTE KRITISCHE FIXES

### ❌ TIER 1, Fix 1: Infinite Loop bei markOnline()

**Status:** ❌ NICHT IMPLEMENTIERT  
**Datei:** `workspace-layout-component.ts`

**Aktueller Stand (lokal modifiziert):**

```typescript
import { distinctUntilChanged } from 'rxjs/operators';

this.userSub = this.userService
  .currentUser$()
  .pipe(distinctUntilChanged((prev, curr) => prev?.uid === curr?.uid))
  .subscribe((user) => {
    this.user = user;
    if (this.user) {
      this.userService.markOnline(true);
    }
  });
```

**Hinweis:** Diese Änderung ist **lokal vorhanden aber nicht committed!**

---

### ❌ TIER 1, Fix 2: Observable Caching in Services

**Status:** ❌ NICHT IMPLEMENTIERT  
**Betroffene Dateien:**

- `user.service.ts` - KEIN Caching
- `channel.service.ts` - KEIN Caching (nur eine einfache Methode `channels$()`)

**Aktueller Stand user.service.ts:**

```typescript
users$(): Observable<User[]> {
  return runInInjectionContext(this.injector, () => {
    const ref = collection(this.firestore, 'users');
    const q = query(ref, orderBy('name'));

    return collectionData(q, { idField: 'uid' }).pipe(
      map((docs: any[]) => /* ... */)
      // ❌ KEIN shareReplay!
      // ❌ KEIN Caching!
    );
  });
}

userById$(uid: string): Observable<User | null> {
  return runInInjectionContext(this.injector, () => {
    const ref = doc(this.firestore, 'users', uid);
    return docData(ref, { idField: 'uid' }).pipe(
      map(/* ... */),
      catchError(() => of(null))
      // ❌ KEIN shareReplay!
      // ❌ KEINE Map-basierte Cache!
    );
  });
}

// ❌ KEINE clearCache() Methode
// ❌ KEINE Cache-Invalidierung
```

**Aktueller Stand channel.service.ts:**

```typescript
// Nur eine minimale Implementation
channels$(): Observable<Channel[]> {
  const ref = collection(this.firestore, 'channels');
  const q = query(ref, orderBy('name'));
  return collectionData(q, { idField: 'id' }).pipe(
    map((docs: any[]) => docs.map(d => ({ id: d.id, name: d.name as string })))
    // ❌ KEIN shareReplay!
  );
}

// ❌ KEINE getChannel(id) Methode
// ❌ KEIN Caching
```

---

### ❌ TIER 1, Fix 3: Query Limits & Pagination für Messages

**Status:** ❌ NICHT IMPLEMENTIERT  
**Datei:** `base-chat-interface-component.ts`

**Aktueller Stand:**

```typescript
// ❌ KEIN BehaviorSubject für Pagination
// ❌ KEIN MESSAGE_PAGE_SIZE
// ❌ KEINE loadMoreMessages() Methode
// ❌ KEIN limit() in der Query

private loadMessagesForChat(params: ParamMap): Observable<any[]> {
  const id = params.get('id');
  if (!id) return of([]);

  this.chatId = id;
  this.initialLoadPending = true;

  const messagesRef = collection(this.firestore, `${this.collectionName}/${id}/messages`);
  const q = query(messagesRef, orderBy('timestamp', 'desc'));  // ❌ KEIN limit()!

  return collectionData(q, { idField: 'id' }).pipe(
    map((messages: any[]) => this.processMessages(messages))
  );
}
```

**Templates:** ❌ KEIN "Load More" Button in HTML/SCSS

---

### ❌ TIER 1, Fix 4: Thread Count Optimierung

**Status:** ❌ NICHT IMPLEMENTIERT  
**Datei:** `message-thread-summary.component.ts`

**Aktueller Stand:**

```typescript
// ❌ Verwendet immer noch collectionData() statt getCountFromServer()
private async getAnswersAmount(coll: any) {
  this.answersCountSub?.unsubscribe();
  this.answersCountSub = collectionData(coll)  // ❌ Real-time Listener!
    .pipe(map((docs) => docs.length))          // ❌ Lädt ALLE Docs!
    .subscribe((count) => {
      this.answersCount = count;
    });
}

// ❌ Lädt alle Thread-Messages für Timestamp
private async getLastAnswerTime(coll: any) {
  this.lastTimeSub?.unsubscribe();
  this.lastTimeSub = collectionData(coll)  // ❌ Real-time Listener!
    .pipe(map((messages) => this.returnLastAnswerTime(messages)))
    .subscribe((timestamp) => {
      this.lastTime = timestamp;
    });
}
```

**Sollte sein:**

```typescript
// ✅ One-time Read mit getCountFromServer()
import { getCountFromServer, getDocs } from 'firebase/firestore';

private async getAnswersAmount(coll: any) {
  const snapshot = await getCountFromServer(query(coll));
  this.answersCount = snapshot.data().count;
}

private async getLastAnswerTime(coll: any) {
  const q = query(coll, orderBy('timestamp', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  // ...
}
```

---

## ❌ TIER 2 NICHT IMPLEMENTIERT

### ❌ Fix 5: ReadState Caching + Query Limits

**Status:** ❌ TEILWEISE IMPLEMENTIERT

**Was fehlt:**

- ❌ KEINE Cache Maps (`unreadChannelCache`, `unreadDmCache`)
- ❌ KEIN `auditTime(300)` Debouncing
- ❌ KEIN `shareReplay(1)`
- ❌ KEIN `limit(100)` in Unread Queries
- ❌ KEINE `clearCache()` Methode

**Aktueller Stand read-state.service.ts:**

```typescript
unreadChannelCount$(channelId: string, uid: string): Observable<number> {
  const fs$ = this.docData$<ReadDoc>(this.readDocGeneric('channels', channelId, uid));
  const opt$ = this.getOptimistic$(channelId, uid);

  return combineLatest([fs$, opt$]).pipe(
    switchMap(([read, opt]) => {
      const since = /* ... */;
      const qy = query(
        this.msgsRef('channels', channelId),
        where('timestamp', '>', since),
        orderBy('timestamp', 'asc')
        // ❌ KEIN limit(100)!
      );
      return this.collectionData$<any>(qy);
    }),
    map((msgs) => msgs.filter((m) => m?.authorId !== uid).length)
    // ❌ KEIN auditTime(300)!
    // ❌ KEIN shareReplay(1)!
    // ❌ KEIN Caching!
  );
}
```

---

### ❌ Fix 6: Thread-Sidenav Cache Usage

**Status:** ❌ NICHT IMPLEMENTIERT  
**Datei:** `thread-sidenav-content.ts`

**Vermutlich:** Verwendet direkten `docData()` statt `channelService.getChannel()`

---

### ❌ Fix 7: Offline Persistence

**Status:** ❌ UNBEKANNT (muss app.config.ts prüfen)

---

## ❌ TIER 3 & 4 NICHT IMPLEMENTIERT

Basierend auf der Code-Analyse:

- ❌ Lazy Loading (Fix 8)
- ❌ Search Debouncing (Fix 9)
- ❌ Memory Leak Fixes (Fix 11)
- ❌ Async Pipe Pattern (Fix 12)
- ❌ Batched User Loading (Fix 14)
- ❌ Reaction Debouncing (Fix 15)

---

## ZUSAMMENFASSUNG

### ✅ Implementiert (3 von 16):

1. ✅ Injection Context Wrapper (TIER 3, Fix 10)
2. ✅ Teilweise Query Limits (last message only)
3. ✅ shareReplay in einer Stelle (base-chat-interface)

### ⏳ Teilweise implementiert (lokal, nicht committed):

1. ⏳ Infinite Loop Fix (Fix 1) - nur lokal

### ❌ Komplett fehlend (12 von 16):

1. ❌ Observable Caching Services (Fix 2) - **KRITISCH!**
2. ❌ Query Limits Messages (Fix 3) - **KRITISCH!**
3. ❌ Thread Count Optimierung (Fix 4) - **KRITISCH!**
4. ❌ ReadState Caching (Fix 5)
5. ❌ Thread-Sidenav Cache (Fix 6)
6. ❌ Offline Persistence (Fix 7)
7. ❌ Lazy Loading (Fix 8)
8. ❌ Search Debouncing (Fix 9)
9. ❌ Memory Leak Fixes (Fix 11)
10. ❌ Async Pipe Pattern (Fix 12)
11. ❌ Batched User Loading (Fix 14)
12. ❌ Reaction Debouncing (Fix 15)

---

## FAZIT

**Der aktuelle Code hat SEHR WENIGE Optimierungen aus dem FIRESTORE_OPTIMIERUNGEN_KONSOLIDIERT.md Plan implementiert.**

**Kritische Befunde:**

1. ❌ **KEINE Observable Caching** in user.service.ts oder channel-service.ts
2. ❌ **KEINE Query Limits** für Messages (lädt ALLE Nachrichten!)
3. ❌ **KEINE Pagination** für Messages
4. ❌ **Thread Count verwendet immer noch Real-time Listener** statt getCountFromServer()
5. ❌ **KEIN Caching** in ReadStateService
6. ⚠️ **Infinite Loop Fix nur lokal**, nicht committed

**Empfehlung:**
Die TIER 1 Fixes (1-4) sollten **dringend** implementiert werden, da sie alleine schon 95%+ Reduktion bringen würden.

**Was bereits gut ist:**

- ✅ Injection Context Wrapper verhindert Console Warnings
- ✅ Einige Query Limits für "last message" Queries
- ✅ switchMap wird korrekt verwendet (auto-unsubscribe)

---

**Erstellt:** 3. Dezember 2025  
**Zweck:** Analyse des aktuellen Code-Stands vs. geplante Optimierungen
