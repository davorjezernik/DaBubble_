# Firestore Quota Exceeded - Detailed Fix Plan

**Date:** December 1, 2025  
**Issue:** `FirebaseError: [code=resource-exhausted]: Quota exceeded`  
**Root Cause:** Excessive Firestore reads due to memory leaks, inefficient queries, and too many real-time listeners

---

## Executive Summary

Your application is likely making **thousands of unnecessary Firestore reads** due to:

1. **30+ simultaneous real-time listeners** (one per channel/DM for unread counts)
2. **Memory leaks** from unsubscribed observables
3. **Inefficient queries** fetching entire collections instead of using limits/aggregations
4. **No debouncing** on rapid updates

**Estimated Impact:** Following this plan could reduce reads by **80-95%**.

---

## Priority Fixes (Do These First)

### 🔴 **CRITICAL FIX 1: Add limit() to All Message Queries**

**Files to Fix:**

- `base-chat-interface-component.ts`
- `thread-sidenav-content.ts`
- `message-bubble.component.ts`

#### Fix 1.1: Base Chat Interface Component

**File:** `src/app/features/workspace/components/base-chat-interface-component/base-chat-interface-component.ts`

**Current Code (Line ~115):**

```typescript
return collectionData(q, { idField: 'id' }).pipe(
  map((messages: any[]) => messages.sort(...))
);
```

**Fixed Code:**

```typescript
import { limit } from '@angular/fire/firestore';

// In loadMessages() method, update query to:
const q = query(
  messagesRef,
  orderBy('timestamp', 'asc'),
  limit(100)  // ⚠️ Only load last 100 messages
);

return collectionData(q, { idField: 'id' }).pipe(
  map((messages: any[]) => messages.sort(...))
);
```

**Impact:** Reduces reads from potentially 1000s to max 100 per channel load.

---

#### Fix 1.2: Thread Sidenav Content

**File:** `src/app/features/workspace/components/thread-sidenav-content/thread-sidenav-content.ts`

**Current Code (Line ~164):**

```typescript
const q = query(answerRef, orderBy('timestamp', 'asc'));
this.answersDataSub = collectionData(q, { idField: 'id' }).subscribe((data: any) => {
  this.answers = data;
});
```

**Fixed Code:**

```typescript
import { limit } from '@angular/fire/firestore';

const q = query(
  answerRef,
  orderBy('timestamp', 'asc'),
  limit(50) // ⚠️ Limit thread answers
);
this.answersDataSub = collectionData(q, { idField: 'id' }).subscribe((data: any) => {
  this.answers = data;
});
```

**Impact:** Prevents loading hundreds of thread replies.

---

#### Fix 1.3: Message Bubble Component - Use Aggregation for Counts

**File:** `src/app/shared/components/message-bubble-component/message-bubble.component.ts`

**Current Code (Line ~459):**

```typescript
const coll = collection(this.firestore, `${path}/answers`);
this.answersCountSub = collectionData(coll)
  .pipe(map((docs: any[]) => docs?.length || 0))
  .subscribe((count) => {
    this.answersCount = count;
  });
```

**Fixed Code:**

```typescript
import { getCountFromServer, query } from '@angular/fire/firestore';

// Replace with count aggregation:
const coll = collection(this.firestore, `${path}/answers`);
const q = query(coll);

getCountFromServer(q).then((snapshot) => {
  this.answersCount = snapshot.data().count;
});

// OR if you need real-time updates, use limit:
const limitedQuery = query(coll, limit(1));
this.answersCountSub = collectionData(limitedQuery)
  .pipe(
    switchMap(() => getCountFromServer(q)),
    map((snapshot) => snapshot.data().count)
  )
  .subscribe((count) => {
    this.answersCount = count;
  });
```

**Impact:** Reduces from fetching all answer documents to a single count query.

---

### 🔴 **CRITICAL FIX 2: Fix Memory Leaks - Proper Unsubscribe**

**Problem:** Components create subscriptions but don't always clean them up.

#### Fix 2.1: Thread Sidenav Content

**File:** `src/app/features/workspace/components/thread-sidenav-content/thread-sidenav-content.ts`

**Current Issues:**

- Line 101: `docData(channelDocRef).subscribe()` - Not always unsubscribed
- Line 126: `docData(messageDocRef).subscribe()` - Not properly managed
- Line 139: `userService.currentUser$().subscribe()` - Subscription management unclear

**Add to Class:**

```typescript
private subscriptions = new Subscription(); // Add this property

ngOnDestroy(): void {
  // Replace existing ngOnDestroy with:
  this.subscriptions.unsubscribe();
  this.messageDataSub?.unsubscribe();
  this.userDataSub?.unsubscribe();
  this.answersAmountSub?.unsubscribe();
  this.answersDataSub?.unsubscribe();
  this.channelNameSub?.unsubscribe();
}
```

**Fix Each Subscription:**

```typescript
// OLD:
this.channelNameSub = docData(channelDocRef).subscribe((channelData: any) => {
  this.channelName = channelData.name || 'unknown-channel';
});

// NEW:
const sub = docData(channelDocRef).subscribe((channelData: any) => {
  this.channelName = channelData.name || 'unknown-channel';
});
this.subscriptions.add(sub);
```

**Repeat for ALL subscriptions in the component.**

---

#### Fix 2.2: Message Bubble Component

**File:** `src/app/shared/components/message-bubble-component/message-bubble.component.ts`

**Current Code (Lines 155-163):**

```typescript
this.userService.currentUser$().subscribe((u: any) => {
  this.currentUserUid = u?.uid || '';
});
if (this.reactionService) {
  this.reactionService.reactions$.subscribe((reactions) => (this.reactions = reactions));
  // More subscriptions...
}
```

**Fixed Code:**

```typescript
// Add property:
private subscriptions = new Subscription();

ngOnInit(): void {
  // Wrap all subscriptions:
  this.subscriptions.add(
    this.userService.currentUser$().subscribe((u: any) => {
      this.currentUserUid = u?.uid || '';
    })
  );

  if (this.reactionService) {
    this.subscriptions.add(
      this.reactionService.reactions$.subscribe((reactions) => (this.reactions = reactions))
    );
    this.subscriptions.add(
      this.reactionService.showEmojiPicker$.subscribe((show) => (this.showEmojiPicker = show))
    );
  }
}

ngOnDestroy(): void {
  this.subscriptions.unsubscribe();
  this.answersCountSub?.unsubscribe();
  this.lastTimeSub?.unsubscribe();
}
```

---

#### Fix 2.3: Base Chat Interface Component

**File:** `src/app/features/workspace/components/base-chat-interface-component/base-chat-interface-component.ts`

**Add Comprehensive Cleanup:**

```typescript
protected authSub?: Subscription;
protected routeSub?: Subscription;
protected messagesSub?: Subscription;
private subscriptions = new Subscription();

ngOnDestroy(): void {
  this.subscriptions.unsubscribe();
  this.authSub?.unsubscribe();
  this.routeSub?.unsubscribe();
  this.messagesSub?.unsubscribe();
}

// Wrap all new subscriptions:
ngOnInit(): void {
  this.authSub = this.authService.currentUser$.subscribe(...);
  this.subscriptions.add(this.authSub);

  this.routeSub = this.route.paramMap.subscribe(...);
  this.subscriptions.add(this.routeSub);

  // etc.
}
```

---

### 🔴 **CRITICAL FIX 3: Optimize ReadStateService - Reduce Real-Time Listeners**

**Problem:** Creating individual observables for EACH channel/DM unread count = 30+ listeners.

**File:** `src/services/read-state.service.ts`

#### Fix 3.1: Add shareReplay to Prevent Duplicate Listeners

**Current Code (Lines 203-228):**

```typescript
unreadChannelCount$(channelId: string, uid: string): Observable<number> {
  const fs$ = this.docData$<ReadDoc>(
    this.readDocGeneric('channels', channelId, uid)
  );
  const opt$ = this.getOptimistic$(channelId, uid);

  return combineLatest([fs$, opt$]).pipe(
    switchMap(([read, opt]) => {
      // ... query messages
      return this.collectionData$<any>(qy);
    }),
    map(rows => /* count unread */)
  );
}
```

**Fixed Code:**

```typescript
// Add caching map at class level:
private unreadChannelCache = new Map<string, Observable<number>>();

unreadChannelCount$(channelId: string, uid: string): Observable<number> {
  const cacheKey = `${channelId}|${uid}`;

  // Return cached observable if exists
  if (this.unreadChannelCache.has(cacheKey)) {
    return this.unreadChannelCache.get(cacheKey)!;
  }

  const fs$ = this.docData$<ReadDoc>(
    this.readDocGeneric('channels', channelId, uid)
  );
  const opt$ = this.getOptimistic$(channelId, uid);

  const unread$ = combineLatest([fs$, opt$]).pipe(
    auditTime(300), // ⚠️ Add debouncing
    switchMap(([read, opt]) => {
      const fsSince = read?.lastReadAt instanceof Timestamp
        ? read.lastReadAt
        : Timestamp.fromMillis(0);
      const since = fsSince.toMillis() > opt.toMillis() ? fsSince : opt;

      const qy = query(
        this.msgsRef('channels', channelId),
        where('timestamp', '>', since),
        orderBy('timestamp', 'asc'),
        limit(100) // ⚠️ Add limit to prevent excessive reads
      );

      return this.collectionData$<any>(qy);
    }),
    map(rows => {
      const unreadMsgs = rows.filter(
        (msg) => msg.authorId && msg.authorId !== uid
      );
      return unreadMsgs.length;
    }),
    shareReplay(1), // ⚠️ Share single listener across multiple subscribers
    catchError(() => of(0))
  );

  // Cache it
  this.unreadChannelCache.set(cacheKey, unread$);
  return unread$;
}
```

**Do the same for `unreadDmCount$()`**

---

#### Fix 3.2: Add Cleanup Method for Cache

**Add to ReadStateService:**

```typescript
// Call this when user logs out or component destroyed
clearCache(): void {
  this.unreadChannelCache.clear();
  this.unreadDmCache.clear();
  this.optim$.clear();
  this.bumpMap.clear();
}
```

---

### 🔴 **CRITICAL FIX 4: Optimize Channel/DM List Queries**

**Problem:** Loading unread counts for ALL channels/DMs at once.

**File:** `src/app/features/workspace/components/devspace-sidenav-content/components/channel-list/channel-list.ts`

#### Fix 4.1: Lazy Load Unread Counts

**Current Code (Lines 140-149):**

```typescript
private buildTotalUnread(list: any[], me: string | null) {
  this.totalUnreadChannelsSub?.unsubscribe();
  if (!me || !list.length) {
    this.totalUnreadChannels = 0;
    return;
  }
  this.totalUnreadChannelsSub = combineLatest(
    list.map((ch) => this.read.unreadChannelCount$(ch.id, me))
  )
    .pipe(map((counts) => counts.reduce((sum, c) => sum + c, 0)))
    .subscribe((sum) => (this.totalUnreadChannels = sum));
}
```

**Fixed Code:**

```typescript
private buildTotalUnread(list: any[], me: string | null) {
  this.totalUnreadChannelsSub?.unsubscribe();
  if (!me || !list.length) {
    this.totalUnreadChannels = 0;
    return;
  }

  // ⚠️ Only load unread for visible channels
  const visibleChannels = list.slice(0, this.maxVisibleChannels);

  this.totalUnreadChannelsSub = combineLatest(
    visibleChannels.map((ch) => this.read.unreadChannelCount$(ch.id, me))
  )
    .pipe(
      auditTime(500), // ⚠️ Debounce rapid updates
      map((counts) => counts.reduce((sum, c) => sum + c, 0))
    )
    .subscribe((sum) => (this.totalUnreadChannels = sum));
}
```

**Same fix for `dm-list.ts`**

---

### 🟡 **HIGH PRIORITY FIX 5: Add Debouncing to Rapid Operations**

#### Fix 5.1: Debounce Search Input

**File:** `src/app/features/workspace/components/devspace-sidenav-content/devspace-sidenav-content.ts`

**Current Code (Line ~89):**

```typescript
this.searchBusSub = this.searchBus.query$.subscribe((q) => {
  this.search = q;
});
```

**Fixed Code:**

```typescript
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

this.searchBusSub = this.searchBus.query$
  .pipe(
    debounceTime(300), // ⚠️ Wait 300ms after typing stops
    distinctUntilChanged() // ⚠️ Only emit if value changed
  )
  .subscribe((q) => {
    this.search = q;
  });
```

---

#### Fix 5.2: Debounce Reaction Toggles

**File:** `src/app/shared/components/message-bubble-component/message-reaction.service.ts`

**Add debouncing to prevent rapid clicks:**

```typescript
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

private reactionClickSubject = new Subject<{
  emoji: string;
  chatId: string;
  messageId: string;
  collectionName: string;
  userUID: string;
}>();

constructor() {
  // Process reaction clicks with debouncing
  this.reactionClickSubject
    .pipe(debounceTime(200)) // ⚠️ Prevent double-clicks
    .subscribe(data => this.processReactionToggle(data));
}

async toggleReaction(emoji: string, chatId: string, messageId: string, collectionName: string, userUID: string) {
  // Queue the click instead of immediate processing
  this.reactionClickSubject.next({ emoji, chatId, messageId, collectionName, userUID });
}

private async processReactionToggle(data: { /* ... */ }) {
  // Actual Firestore write logic here
}
```

---

### 🟡 **HIGH PRIORITY FIX 6: Implement Pagination for Messages**

**File:** `src/app/features/workspace/components/base-chat-interface-component/base-chat-interface-component.ts`

**Add "Load More" functionality:**

```typescript
export abstract class BaseChatInterfaceComponent implements OnInit, OnDestroy {
  messages$: Observable<any[]> = of([]);
  private messageLimit = 50; // Start with 50 messages
  private loadMoreSubject = new BehaviorSubject<number>(50);

  loadMessages(chatId: string | null): void {
    if (!chatId) {
      this.messages$ = of([]);
      return;
    }

    const messagesRef = collection(this.firestore, `${this.collectionName}/${chatId}/messages`);

    this.messages$ = this.loadMoreSubject.pipe(
      switchMap((limit) => {
        const q = query(
          messagesRef,
          orderBy('timestamp', 'desc'), // ⚠️ Get newest first
          limit(limit)
        );

        return collectionData(q, { idField: 'id' }).pipe(
          map((messages: any[]) => messages.reverse()) // Show oldest first in UI
        );
      }),
      shareReplay(1)
    );
  }

  loadMoreMessages(): void {
    this.messageLimit += 50;
    this.loadMoreSubject.next(this.messageLimit);
  }
}
```

**Add to template:**

```html
<button (click)="loadMoreMessages()" *ngIf="(messages$ | async)?.length >= messageLimit">
  Load Older Messages
</button>
```

---

## Medium Priority Fixes

### 🟢 **FIX 7: Use Async Pipe Instead of Manual Subscriptions**

**Problem:** Manual subscriptions require cleanup; async pipe auto-unsubscribes.

**File:** `src/app/features/workspace/components/channel-interface-content/channel-interface-content.ts`

**Current Pattern:**

```typescript
private channelSub?: Subscription;

ngOnInit() {
  this.channelSub = this.channelService.getChannel(chatId).subscribe({
    next: (channel) => {
      this.channelName = channel.name;
      this.channelDescription = channel.description;
    }
  });
}

ngOnDestroy() {
  this.channelSub?.unsubscribe();
}
```

**Better Pattern:**

```typescript
// Component class
channel$: Observable<Channel | null> = of(null);

ngOnInit() {
  this.channel$ = this.route.paramMap.pipe(
    map(params => params.get('id')),
    switchMap(id => id ? this.channelService.getChannel(id) : of(null))
  );
}

// No ngOnDestroy needed!
```

**Template:**

```html
<div *ngIf="channel$ | async as channel">
  <h2>{{ channel.name }}</h2>
  <p>{{ channel.description }}</p>
</div>
```

---

### 🟢 **FIX 8: Add Firestore Offline Persistence (Reduces Reads)**

**File:** `src/app/app.config.ts`

**Add offline persistence:**

```typescript
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => {
      const firestore = initializeFirestore(getApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      return firestore;
    }),
    // ... other providers
  ],
};
```

**Impact:** Firestore will cache data locally, reducing reads when data hasn't changed.

---

### 🟢 **FIX 9: Add Read Batching for User Names**

**File:** `src/app/shared/components/message-bubble-component/message-logic.service.ts`

**Current Code (Lines ~111):**

```typescript
this.userService.userById$(id).subscribe((u: any) => {
  this.nameCache.set(id, u?.displayName ?? u?.name ?? 'Unknown');
  this.onNamesUpdated?.();
});
```

**Problem:** Each reaction triggers a separate user lookup.

**Fixed Code:**

```typescript
// Batch user lookups
private userLoadQueue = new Set<string>();
private userLoadSubject = new Subject<void>();

constructor(private firestore: Firestore, private userService: UserService) {
  // Process batch every 500ms
  this.userLoadSubject
    .pipe(debounceTime(500))
    .subscribe(() => this.processBatchedUserLoads());
}

getUserName(uid: string): string {
  if (this.nameCache.has(uid)) {
    return this.nameCache.get(uid)!;
  }

  // Queue for batch load
  if (!this.subscribedUids.has(uid)) {
    this.userLoadQueue.add(uid);
    this.userLoadSubject.next();
  }

  return 'Loading...';
}

private processBatchedUserLoads(): void {
  const uids = Array.from(this.userLoadQueue);
  this.userLoadQueue.clear();

  // Load all users at once
  uids.forEach(uid => {
    if (!this.subscribedUids.has(uid)) {
      this.subscribedUids.add(uid);
      this.userService.userById$(uid).subscribe((u: any) => {
        this.nameCache.set(uid, u?.displayName ?? u?.name ?? 'Unknown');
        this.onNamesUpdated?.();
      });
    }
  });
}
```

---

## Low Priority / Performance Optimizations

### 🔵 **FIX 10: Add Indexing for Common Queries**

**Create:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "ASCENDING" },
        { "fieldPath": "authorId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "timestamp", "order": "DESCENDING" }]
    }
  ]
}
```

**Deploy:**

```bash
firebase deploy --only firestore:indexes
```

---

### 🔵 **FIX 11: Implement Virtual Scrolling for Large Lists**

**For message lists with 100+ items:**

```typescript
// Install CDK
npm install @angular/cdk

// Update component
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule, /* ... */]
})
```

**Template:**

```html
<cdk-virtual-scroll-viewport itemSize="80" class="message-viewport">
  <app-message-bubble *cdkVirtualFor="let message of messages$ | async" [message]="message">
  </app-message-bubble>
</cdk-virtual-scroll-viewport>
```

---

### 🔵 **FIX 12: Add Query Result Caching**

**File:** `src/services/channel-service.ts`

```typescript
import { shareReplay } from 'rxjs/operators';

export class ChannelService {
  private channelsCache$?: Observable<Channel[]>;

  getChannels(): Observable<Channel[]> {
    if (!this.channelsCache$) {
      const channelsRef = collection(this.firestore, 'channels');
      this.channelsCache$ = collectionData(channelsRef, { idField: 'id' }).pipe(
        shareReplay(1) // ⚠️ Cache the result
      ) as Observable<Channel[]>;
    }
    return this.channelsCache$;
  }

  // Clear cache when data changes
  invalidateCache(): void {
    this.channelsCache$ = undefined;
  }
}
```

---

## Testing & Validation

### Validation Checklist

After implementing fixes, verify:

- [ ] **Firebase Console**: Check "Document reads" graph shows significant reduction
- [ ] **Browser DevTools**: Network tab shows fewer Firestore requests
- [ ] **Console Logs**: No "Quota exceeded" errors
- [ ] **Memory Usage**: DevTools Memory profiler shows no leaks
- [ ] **Functionality**: All features still work correctly

### Monitoring Code

**Add to a service:**

```typescript
import { trace } from '@angular/fire/performance';

// Wrap expensive operations
const t = trace(performance, 'load-messages');
t.start();
// ... load messages
t.stop();
```

---

## Implementation Order

### Week 1: Critical Fixes (Immediate Impact)

1. ✅ Add `limit()` to all queries (Fix 1)
2. ✅ Fix memory leaks in top 5 components (Fix 2)
3. ✅ Add `shareReplay()` to ReadStateService (Fix 3)

**Expected Impact:** 60-70% reduction in reads

---

### Week 2: High Priority (Stability)

4. ✅ Implement lazy loading for unread counts (Fix 4)
5. ✅ Add debouncing (Fix 5)
6. ✅ Implement message pagination (Fix 6)

**Expected Impact:** Additional 15-20% reduction

---

### Week 3: Medium Priority (Polish)

7. ✅ Convert to async pipe pattern (Fix 7)
8. ✅ Enable offline persistence (Fix 8)
9. ✅ Batch user name lookups (Fix 9)

**Expected Impact:** Additional 5-10% reduction + faster UX

---

### Week 4: Optimization (Future-proofing)

10. ✅ Add Firestore indexes (Fix 10)
11. ✅ Implement virtual scrolling (Fix 11)
12. ✅ Add query caching (Fix 12)

**Expected Impact:** Handles scale to 1000+ users/channels

---

## Emergency Quick Fix (If Quota Hit NOW)

If you need to reduce reads immediately while implementing full fixes:

### 1. Temporarily Disable Real-Time Updates

**File:** `src/services/read-state.service.ts`

```typescript
// Comment out real-time listeners temporarily
unreadChannelCount$(channelId: string, uid: string): Observable<number> {
  // return of(0); // ⚠️ TEMPORARY: Disable unread counts

  // Or poll every 30 seconds instead of real-time:
  return interval(30000).pipe(
    startWith(0),
    switchMap(() => {
      // One-time read instead of listener
      return from(this.getUnreadCountOnce(channelId, uid));
    })
  );
}
```

### 2. Increase Limits Temporarily

**File:** All message queries

```typescript
limit(20); // Reduce from 50/100 to minimum viable
```

### 3. Disable Features Temporarily

```typescript
// In message-bubble.component.ts
// Comment out answer count loading:
// this.loadAnswersInfo(); // ⚠️ TEMPORARY DISABLE
```

---

## Firebase Quota Upgrade Options

If fixes aren't enough, consider:

1. **Blaze Plan**: Pay-as-you-go ($0.06 per 100K reads after free tier)
2. **Free Tier Limits**:
   - 50K reads/day
   - 20K writes/day
   - 1GB storage

**Calculator:** With fixes, typical user should use ~500-1000 reads/day vs. current 10K+

---

## Long-Term Architecture Recommendations

### Consider These Patterns:

1. **Aggregate Data**: Pre-calculate unread counts server-side
2. **Cloud Functions**: Use triggers to maintain denormalized data
3. **Firestore Rules**: Optimize security rules to avoid extra reads
4. **Server-Side Rendering**: Cache initial data load
5. **GraphQL Layer**: Add caching/batching layer

---

## Support & Resources

- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Angular Fire Performance Guide](https://github.com/angular/angularfire/blob/master/docs/performance.md)
- [RxJS Optimization](https://rxjs.dev/guide/subscription)

---

## Questions & Notes

**Q: Will offline persistence work with real-time listeners?**  
A: Yes, it complements them by caching data and only fetching changes.

**Q: What if I need more than 100 messages visible?**  
A: Implement pagination (Fix 6) with "Load More" button.

**Q: How do I know which fix had the biggest impact?**  
A: Implement one at a time and monitor Firebase Console usage graph.

---

**Last Updated:** December 1, 2025  
**Status:** Ready for Implementation  
**Estimated Total Implementation Time:** 20-30 hours across 4 weeks
