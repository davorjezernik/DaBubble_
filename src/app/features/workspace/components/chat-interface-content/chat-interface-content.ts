import { Component, OnInit } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { query, orderBy, collectionData } from '@angular/fire/firestore';
import { firstValueFrom, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../services/auth-service';

@Component({
  selector: 'app-chat-interface-component',
  standalone: true,
  imports: [MessageAreaComponent, CommonModule],
  templateUrl: './chat-interface-content.html',
  styleUrl: './chat-interface-component.scss',
})
export class ChatInterfaceComponent implements OnInit {
  messages$: Observable<any[]> = of([]);
  isOwnDm: boolean = false;

  recipientData: any = null;

  chatId: string | null = null;

  constructor(
    public firestore: Firestore,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(async (params) => {
      this.chatId = params.get('id');
      await this.checkIfOwnDm();
      await this.getMessageDetails();
    });

    this.messages$ = this.route.paramMap.pipe(
      switchMap((params) => {
        this.chatId = params.get('id');
        if (this.chatId) {
          const messagesRef = collection(this.firestore, `dms/${this.chatId}/messages`);

          const q = query(messagesRef, orderBy('timestamp'));

          return collectionData(q, { idField: 'id' });
        } else {
          return of([]);
        }
      })
    );
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
    // Renamed from isOwnDm
    const user: any = await firstValueFrom(this.authService.currentUser$);
    const ownDmId = `${user.uid}-${user.uid}`;
    if (ownDmId === this.chatId) {
      this.isOwnDm = true;
    } else {
      this.isOwnDm = false;
    }
  }

  async getMessageDetails() {
    let recipientId: any = null;

    const user: any = await firstValueFrom(this.authService.currentUser$);

    const dmRef = doc(this.firestore, `dms/${this.chatId}`);
    const dmSnap = await getDoc(dmRef);

    if (!dmSnap.exists()) {
      console.warn(`DM document not found for chatId: ${this.chatId}`);
      this.recipientData = null;
      return;
    }

    const dmData = dmSnap.data() as any;
    const members = dmData.members || [];

    const isPersonalDm = members.length === 2 && members[0] === members[1];
    if (isPersonalDm) {
      recipientId = members[0];
    } else {
      recipientId = members.find((id: string) => id !== user.uid);
    }

    const recipientRef = doc(this.firestore, `users/${recipientId}`);
    const recipientSnap = await getDoc(recipientRef);
    this.recipientData = recipientSnap.data() as any;
  }
}
