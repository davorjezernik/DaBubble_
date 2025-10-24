import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Channel, ChannelService } from '../../../../../services/channel-service';
import { firstValueFrom, Subscription, switchMap } from 'rxjs';
import { collectionData, Firestore, serverTimestamp } from '@angular/fire/firestore';
import { addDoc, collection, orderBy, query } from '@firebase/firestore';
import { AuthService } from '../../../../../services/auth-service';
import { BaseChatInterfaceComponent } from '../base-chat-interface-component/base-chat-interface-component';

@Component({
  selector: 'app-channel-interface-content',
  imports: [MessageAreaComponent, RouterModule],
  templateUrl: './channel-interface-content.html',
  styleUrl: './channel-interface-content.scss',
})
export class ChannelInterfaceContent extends BaseChatInterfaceComponent implements OnInit, OnDestroy {
  chatId: string | null = null;

  routeSub?: Subscription;
  messagesSub?: Subscription;

  channelData: Channel | null = null;

  messages: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private channelService: ChannelService,
    private authService: AuthService,
    private firestore: Firestore
  ) {
    super();
  }

  ngOnInit(): void {
    this.getChannelDataBasedOnRoute();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.messagesSub?.unsubscribe();
  }

  getChannelDataBasedOnRoute() {
    this.routeSub = this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          this.chatId = id;
          if (id) {
            this.getMessages(id);
            return this.channelService.getChannel(id);
          }
          this.messages = [];
          return [];
        })
      )
      .subscribe({
        next: (data) => {
          this.channelData = data;
        },
        error: (err) => console.log('Error fetching channel data:', err),
      });
  }

  async handleNewMessage(messageText: string) {
    if (!this.chatId) return;

    const user: any = await firstValueFrom(this.authService.currentUser$);
    const messageData = {
      text: messageText,
      timestamp: serverTimestamp(),
      authorId: user.uid,
    };
    const messagesCollectionRef = collection(this.firestore, `channels/${this.chatId}/messages`);
    await addDoc(messagesCollectionRef, messageData);
  }

  getMessages(channelId: string) {
    this.messagesSub?.unsubscribe();

    const messagesCollection = collection(this.firestore, `channels/${channelId}/messages`);
    const q = query(messagesCollection, orderBy('timestamp', 'desc'));

    this.messagesSub = collectionData(q, { idField: 'id' }).subscribe((messages) => {
      this.messages = messages;
    });
  }
}
