import { Directive, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  doc,
  Firestore,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  limit,
} from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../../../../services/auth-service';
import { User } from '@angular/fire/auth';

@Directive()
export abstract class BaseChatInterfaceComponent implements OnInit, OnDestroy {
  abstract collectionName: 'channels' | 'dms';

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages$: Observable<any[]> = of([]);
  hasMore$: Observable<boolean> = of(false);
  private messageLimitSubject = new BehaviorSubject<number>(50);
  private readonly MESSAGE_PAGE_SIZE = 50;
  chatId: string | null = null;
  currentUserId: string | null = null;
  currentUserAvatar: string = 'assets/img-profile/profile.png';
  currentUserDisplayName: string = 'Unknown User';
  currentUserProfile: any | null = null;
  protected routeSub?: Subscription;
  protected authSub?: Subscription;
  protected messagesSub?: Subscription;
  private subscriptions = new Subscription(); // Centralized subscription management
  /** Scroll behavior flags */
  private scrollAfterMySend = false; // only scroll when I send via message area
  private initialLoadPending = true; // keep autoscroll on first load

  constructor(
    protected route: ActivatedRoute,
    protected firestore: Firestore,
    protected authService: AuthService
  ) {}

  /**
   * Initialize auth-dependent state and set up the reactive message stream and metadata loading.
   */
  ngOnInit(): void {
    this.authSub = this.authService.currentUser$.subscribe(async (user: User | null) => {
      this.currentUserId = user?.uid ?? null;
      if (user?.uid) {
        try {
          this.currentUserProfile = await this.getUserData(user.uid);
          this.currentUserAvatar =
            this.currentUserProfile?.avatar || 'assets/img-profile/profile.png';
          this.currentUserDisplayName = this.currentUserProfile?.name || 'Unknown User';
        } catch {
          this.currentUserProfile = null;
        }
      } else {
        this.currentUserProfile = null;
      }
    });
    this.subscriptions.add(this.authSub);

    this.initializeMessagesStream();
    this.loadChatMetadata();
  }

  /** Clean up subscriptions created by this base class. */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.routeSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.messagesSub?.unsubscribe();
  }

  /**
   * Subscribe to route param `id` to detect chat changes and forward to `onChatIdChanged`.
   * Child components can override `onChatIdChanged` to load metadata.
   */
  protected loadChatMetadata(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.chatId = params.get('id');
      if (this.chatId) {
        this.onChatIdChanged(this.chatId);
      }
    });
    this.subscriptions.add(this.routeSub);
  }

  /**
   * Hook: called whenever the route `id` changes.
   * @param chatId New chat id (document id under the selected collection)
   */
  protected onChatIdChanged(chatId: string): void {
    // Default implementation does nothing.
  }

  /**
   * Build the reactive messages stream for the current chat.
   * - Listens to route `id`
   * - Queries Firestore messages ordered by timestamp desc
   * - Maps into processed messages (e.g., insert date separators)
   * - Auto-scrolls to bottom on updates
   */
  private initializeMessagesStream(): void {
    this.messages$ = combineLatest([
      this.route.paramMap,
      this.messageLimitSubject
    ]).pipe(
      switchMap(([params, currentLimit]) => {
        const id = params.get('id');
        if (!id) return of([]);

        this.chatId = id;
        // When switching chats, reset to initial page size
        if (this.chatId !== id) {
          this.messageLimitSubject.next(this.MESSAGE_PAGE_SIZE);
        }
        this.initialLoadPending = true;
        const messagesRef = collection(this.firestore, `${this.collectionName}/${id}/messages`);
        const q = query(
          messagesRef, 
          orderBy('timestamp', 'desc'),
          limit(currentLimit)
        );

        // collectionData returns an Observable that auto-unsubscribes when the outer switchMap switches
        // This prevents memory leaks from old chat listeners
        return collectionData(q, { idField: 'id' }).pipe(
          map((messages: any[]) => this.processMessages(messages))
        );
      }),
      shareReplay(1) // Cache the latest result to prevent duplicate listeners
    );

    // Determine if there are more messages to load
    this.hasMore$ = combineLatest([
      this.messages$,
      this.messageLimitSubject
    ]).pipe(
      map(([messages, currentLimit]) => messages.length >= currentLimit),
      shareReplay(1)
    );
    this.messagesSub = this.messages$.subscribe(() => {
      if (this.initialLoadPending || this.scrollAfterMySend) {
        setTimeout(() => this.scrollToBottom(), 50);
        this.initialLoadPending = false;
        this.scrollAfterMySend = false;
      }
    });
    this.subscriptions.add(this.messagesSub);
  }

  /**
   * Post-process raw messages to annotate boundaries (e.g., show date separator when day changes).
   * @param messages Raw messages from Firestore (descending order from query)
   * @returns Messages array with `showDateSeparator` flags preserved in original order
   */
  private processMessages(messages: any[]): any[] {
    let lastDate: string | null = null;

    const reversedMessages = [...messages].reverse();

    const processedMessages = reversedMessages.map((message) => {
      const messageDate = message.timestamp?.toDate().toDateString();
      const showDateSeparator = messageDate !== lastDate;
      lastDate = messageDate;
      return { ...message, showDateSeparator };
    });
    return processedMessages.reverse();
  }

  /**
   * Send a new message into the current chat.
   * @param messageText Plain text content. Requires `chatId` and `currentUserId` to be set.
   */
  async handleNewMessage(messageText: string): Promise<void> {
    if (!this.chatId || !this.currentUserId) return;

    const messageData = {
      text: messageText,
      timestamp: serverTimestamp(),
      sortAt: Timestamp.now(),
      authorId: this.currentUserId,
      authorAvatar: this.currentUserAvatar,
      authorName: this.currentUserDisplayName,
    };

    const messagesCollectionRef = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages`
    );
    // Mark that the next messages$ emission should trigger an autoscroll
    this.scrollAfterMySend = true;
    await addDoc(messagesCollectionRef, messageData);
  }

  /**
   * Fetch a user's document and normalize the avatar field for UI.
   * @param userId User uid to load from `users/` collection.
   * @returns The user data object or null if not found.
   */
  protected async getUserData(userId: string): Promise<any | null> {
    const userRef = doc(this.firestore, `users/${userId}`);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const data: any = userSnap.data();
    data.avatar = this.normalizeAvatar(data?.avatar);
    return data;
  }

  /**
   * Normalize the avatar string for safe rendering:
   * - If empty → default asset
   * - If absolute URL → keep as is
   * - If relative path → ensure it starts with `assets/`
   */
  protected normalizeAvatar(raw?: string): string {
    if (!raw) return 'assets/img-profile/profile.png';
    if (/^https?:\/\//i.test(raw)) return raw;
    const clean = raw.replace(/^\/+/, '');
    return clean.startsWith('assets/') ? clean : `assets/${clean}`;
  }

  // Keep a reference to the last message timestamp rendered in the main list
  // to support legacy/separate date-separator logic when needed.
  lastMessageTimestamp: Timestamp | null = null;

  /** Reset the last rendered message timestamp reference. */
  resetLastMessageTimestamp() {
    this.lastMessageTimestamp = null;
  }

  /**
   * Check if a given message timestamp belongs to today.
   * @param messageTimestamp Firestore Timestamp or null
   */
  isTodaysMessage(messageTimestamp: Timestamp | null): boolean {
    if (!messageTimestamp) {
      return false;
    }
    const todayTimestamp = Timestamp.now();
    const todayDate = todayTimestamp.toDate();

    if (todayDate.toDateString() === messageTimestamp.toDate().toDateString()) {
      return true;
    } else {
      return false;
    }
  }

  /** Smoothly scroll the messages container to the bottom. */
  scrollToBottom() {
    const el = this.messagesContainer.nativeElement;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    });
  }

  /**
   * Load more messages by increasing the limit.
   * This will trigger a new Firestore query with the increased limit.
   */
  loadMoreMessages(): void {
    const currentLimit = this.messageLimitSubject.value;
    this.messageLimitSubject.next(currentLimit + this.MESSAGE_PAGE_SIZE);
  }
}
