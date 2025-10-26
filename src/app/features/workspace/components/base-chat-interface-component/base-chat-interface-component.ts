import { Directive, OnDestroy, OnInit } from '@angular/core';
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
} from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { map, Observable, of, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../../../../services/auth-service';
import { User } from '@angular/fire/auth';

@Directive()
export abstract class BaseChatInterfaceComponent implements OnInit, OnDestroy {
  // Abstract property to be implemented by child classes
  abstract collectionName: 'channels' | 'dms';

  messages$: Observable<any[]> = of([]);
  chatId: string | null = null;
  currentUserId: string | null = null;
  currentUserProfile: any | null = null;

  protected routeSub?: Subscription;
  protected authSub?: Subscription;

  constructor(
    protected route: ActivatedRoute,
    protected firestore: Firestore,
    protected authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.currentUser$.subscribe(async (user: User | null) => {
      this.currentUserId = user?.uid ?? null;
      if (user?.uid) {
        try {
          this.currentUserProfile = await this.getUserData(user.uid);
        } catch {
          this.currentUserProfile = null;
        }
      } else {
        this.currentUserProfile = null;
      }
    });

    this.initializeMessagesStream();
    this.loadChatMetadata();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.authSub?.unsubscribe();
  }

  /**
   * Hook for child components to load specific metadata (e.g., channel name or DM recipient).
   */
  protected loadChatMetadata(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.chatId = params.get('id');
      if (this.chatId) {
        this.onChatIdChanged(this.chatId);
      }
    });
  }

  /**
   * Can be overridden by child components to perform actions when the chat ID changes.
   * @param chatId The new chat ID from the route.
   */
  protected onChatIdChanged(chatId: string): void {
    // Default implementation does nothing.
  }

  private initializeMessagesStream(): void {
    this.messages$ = this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id');
        if (!id) return of([]);

        this.chatId = id;
        const messagesRef = collection(this.firestore, `${this.collectionName}/${id}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        return collectionData(q, { idField: 'id' }).pipe(
          map((messages: any[]) => this.processMessages(messages))
        );
      })
    );
  }

  private processMessages(messages: any[]): any[] {
    let lastDate: string | null = null;
    return messages.map((message) => {
      const messageDate = message.timestamp?.toDate().toDateString();
      const showDateSeparator = messageDate !== lastDate;
      lastDate = messageDate;
      return { ...message, showDateSeparator };
    });
  }

  async handleNewMessage(messageText: string): Promise<void> {
    if (!this.chatId || !this.currentUserId) return;

    const messageData = {
      text: messageText,
      timestamp: serverTimestamp(),
      authorId: this.currentUserId,
    };

    const messagesCollectionRef = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages`
    );
    await addDoc(messagesCollectionRef, messageData);
  }

  protected async getUserData(userId: string): Promise<any | null> {
    const userRef = doc(this.firestore, `users/${userId}`);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const data: any = userSnap.data();
    data.avatar = this.normalizeAvatar(data?.avatar);
    return data;
  }

  protected normalizeAvatar(raw?: string): string {
    if (!raw) return 'assets/img-profile/profile.png';
    if (/^https?:\/\//i.test(raw)) return raw;
    const clean = raw.replace(/^\/+/, '');
    return clean.startsWith('assets/') ? clean : `assets/${clean}`;
  }

  lastMessageTimestamp: any | null = null;

  shouldShowDateSeparator(messageTimestamp: Timestamp) {
    if (!messageTimestamp) return false;

    let showSeparator = false;
    const currentDate = messageTimestamp.toDate();

    if (!this.lastMessageTimestamp) {
      showSeparator = true;
    } else {
      const lastDate = this.lastMessageTimestamp.toDate();

      if (currentDate.toDateString() !== lastDate.toDateString()) {
        showSeparator = true;
      }
    }
    this.lastMessageTimestamp = messageTimestamp;
    return showSeparator;
  }

  isTodaysMessage(messageTimestamp: Timestamp | null): boolean {
    if (!messageTimestamp) {
      return false;
    }    const todayTimestamp = Timestamp.now();
    const todayDate = todayTimestamp.toDate();

    if (todayDate.toDateString() === messageTimestamp.toDate().toDateString()) {
      return true;
    } else {
      return false;
    }
  }

  resetLastMessageTimestamp() {
    this.lastMessageTimestamp = null;
  }
}
