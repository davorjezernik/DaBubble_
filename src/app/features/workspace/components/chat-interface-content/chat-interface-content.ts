import { Component, OnInit } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import {
  Firestore,
  doc,
  getDoc,
  addDoc,
  collection,
  collectionData,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth-service';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';

@Component({
  selector: 'app-chat-interface-component',
  standalone: true,
  imports: [MessageAreaComponent, CommonModule, MessageBubbleComponent],
  templateUrl: './chat-interface-content.html',
  styleUrl: './chat-interface-component.scss',
})
export class ChatInterfaceComponent implements OnInit {
  messages$: Observable<any[]> = of([]);
  isOwnDm: boolean = false;

  recipientData: any = null;
  currentUserId: string | null = null;
  currentUserProfile: { name: string; avatar: string } | null = null;

  chatId: string | null = null;

  lastMessageTimestamp: any | null = null;

  constructor(
    public firestore: Firestore,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDmMetadataOnInit();
    this.initializeMessagesStream();
    this.subscribeToCurrentUser();
  }

  loadDmMetadataOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      this.resetLastMessageTimestamp();
      this.chatId = params.get('id');
      await this.checkIfOwnDm();
      await this.getMessageDetails();
    });
  }

  initializeMessagesStream() {
    this.messages$ = this.route.paramMap.pipe(
      switchMap((params) => {
        this.chatId = params.get('id');
        if (this.chatId) {
          const messagesRef = collection(this.firestore, `dms/${this.chatId}/messages`);

          const q = query(messagesRef, orderBy('timestamp', 'asc'));

          return collectionData(q, { idField: 'id' }).pipe(
            map((msgs: any[]) =>
              msgs.map((m, idx, arr) => {
                const curr = m?.timestamp?.toDate ? m.timestamp.toDate() : null;
                const prev = idx > 0 && arr[idx - 1]?.timestamp?.toDate ? arr[idx - 1].timestamp.toDate() : null;
                const showDateSeparator = idx === 0
                  ? true
                  : !!(curr && prev) && curr.toDateString() !== prev.toDateString();
                return { ...m, showDateSeparator };
              })
            )
          );
        } else {
          return of([]);
        }
      })
    );
  }

  private subscribeToCurrentUser() {
    this.authService.currentUser$.subscribe(async (u: any) => {
      this.currentUserId = u?.uid ?? null;
      if (!u) {
        this.currentUserProfile = null;
        return;
      }

      // Try to read profile from users/{uid} to get the avatar stored for this userId
      try {
        const profile = await this.getUserData(u.uid);
        const name = profile?.name || u.displayName || u.email || 'Du';
        const avatar = this.normalizeAvatar(profile?.avatar || u.photoURL || '');
        this.currentUserProfile = { name, avatar };
      } catch {
        const fallbackName = u.displayName || u.email || 'Du';
        const fallbackAvatar = this.normalizeAvatar(u.photoURL || '');
        this.currentUserProfile = { name: fallbackName, avatar: fallbackAvatar };
      }
    });
  }

  resetLastMessageTimestamp() {
    this.lastMessageTimestamp = null;
  }

  async handleNewMessage(messageText: string) {
    if (!this.chatId) {
      console.error('No chat ID found in route parameters.');
      return;
    }
    const user: any = await firstValueFrom(this.authService.currentUser$);
    const messageData = {
      text: messageText,
      timestamp: serverTimestamp(),
      authorId: user.uid,
    };
    const messagesCollectionRef = collection(this.firestore, `dms/${this.chatId}/messages`);
    await addDoc(messagesCollectionRef, messageData);
  }

  async checkIfOwnDm() {
    const user: any = await firstValueFrom(this.authService.currentUser$);
    const ownDmId = `${user.uid}-${user.uid}`;
    if (ownDmId === this.chatId) {
      this.isOwnDm = true;
    } else {
      this.isOwnDm = false;
    }
  }

  async getMessageDetails(): Promise<void> {
    const user = await this.getCurrentUser();
    const dmData = await this.getDmDocument(this.chatId!);
    if (!dmData) {
      this.recipientData = null;
      return;
    }
    const recipientId = this.getRecipientId(dmData.members, user.uid);
    if (!recipientId) {
      this.recipientData = null;
      return;
    }
    this.recipientData = await this.getUserData(recipientId);
  }

  private async getCurrentUser(): Promise<any> {
    return firstValueFrom(this.authService.currentUser$);
  }

  private async getDmDocument(chatId: string): Promise<any | null> {
    const dmRef = doc(this.firestore, `dms/${chatId}`);
    const dmSnap = await getDoc(dmRef);
    if (!dmSnap.exists()) return null;
    return dmSnap.data();
  }

  private getRecipientId(members: string[], currentUserId: string): string | null {
    if (!members || members.length === 0) return null;

    const isPersonalDm = members.length === 2 && members[0] === members[1];
    if (isPersonalDm) return members[0];

    const recipient = members.find((id) => id !== currentUserId);
    return recipient || null;
  }

  private async getUserData(userId: string): Promise<any | null> {
    const userRef = doc(this.firestore, `users/${userId}`);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const data: any = userSnap.data();
    // Normalize avatar to a usable src
    data.avatar = this.normalizeAvatar(data?.avatar);
    return data;
  }

  private normalizeAvatar(raw?: string): string {
    if (!raw) return 'assets/img-profile/profile.png';
    if (/^https?:\/\//i.test(raw)) return raw;
    const clean = raw.replace(/^\/+/, '');
    return clean.startsWith('assets/') ? clean : `assets/${clean}`;
  }

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
    }
    const todayTimestamp = Timestamp.now();
    const todayDate = todayTimestamp.toDate();

    if (todayDate.toDateString() === messageTimestamp.toDate().toDateString()) {
      return true;
    } else {
      return false;
    }
  }
}
