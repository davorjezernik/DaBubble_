import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import {
  addDoc,
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';
import { UserService } from '../../../../../services/user.service';
import { DatePipe } from '@angular/common';
import { ViewStateService } from '../../../../../services/view-state.service';

@Component({
  selector: 'app-thread-sidenav-content',
  standalone: true,
  imports: [MessageAreaComponent, MessageBubbleComponent, DatePipe],
  templateUrl: './thread-sidenav-content.html',
  styleUrls: ['./thread-sidenav-content.scss', 'thread-sidenav-component.responsive.scss'],
})
export class ThreadSidenavContent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() collectionName: 'channels' | 'dms' = 'dms';

  @Output() close = new EventEmitter<void>();

  messageText: string | null = '';
  senderId: string = 'assets/img-profile/profile.png';
  senderAvatar: string = '';
  senderName: string = 'Unknown User';
  messageTimestamp: any;
  messageReactions?: Record<string, number>;
  messageEdited: boolean = false;
  channelName: string = '';

  currentUserData = {
    id: '',
    avatar: '' as string | null,
    displayName: '' as string,
  };

  answersAmount: number = 0;

  messageDataSub?: Subscription;
  userDataSub?: Subscription;
  answersAmountSub?: Subscription;
  answersDataSub?: Subscription;
  channelNameSub?: Subscription;

  messages: any[] = [];

  @ViewChild('chatContent') private chatContent?: ElementRef<HTMLDivElement>;
  private shouldScrollToBottom = true;

  constructor(
    private firestore: Firestore,
    private userService: UserService,
    public viewStateService: ViewStateService
  ) {}

  ngOnInit(): void {}

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnChanges(): void {
    this.accessTriggerMessageData();
    this.getAnswersAmount();
    this.getAllThreadMessages();
    this.getCurrentChannelName();
  }

  private getCurrentChannelName() {
    if (this.collectionName !== 'channels' || !this.chatId) return;
    const channelDocRef = doc(this.firestore, `channels/${this.chatId}`);
    this.channelNameSub = docData(channelDocRef).subscribe((channelData: any) => {
      this.channelName = channelData.name || 'unknown-channel';
    });
  }

  ngOnDestroy(): void {
    this.messageDataSub?.unsubscribe();
    this.userDataSub?.unsubscribe();
    this.answersAmountSub?.unsubscribe();
    this.answersDataSub?.unsubscribe();
  }

  private async accessTriggerMessageData() {
    if (!this.chatId || !this.messageId) return;
    this.subscribeToMessageData();
    this.subscribeToUserData();
  }

  private subscribeToMessageData() {
    const messageDocRef = doc(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}`
    );
    this.messageDataSub = docData(messageDocRef).subscribe((messageData: any) => {
      this.messageText = messageData.text || '';
      this.senderId = messageData.authorId || '';
      this.senderAvatar = messageData.authorAvatar || 'assets/img-profile/profile.png';
      this.senderName = messageData.authorName;
      this.messageTimestamp = messageData.timestamp || null;
      this.messageReactions = messageData.reactions || [];
      this.messageEdited = !!messageData.edited;
    });
  }

  private subscribeToUserData() {
    this.userDataSub = this.userService.currentUser$().subscribe((user: any) => {
      this.currentUserData.id = user?.uid || '';
      this.currentUserData.avatar = user?.avatar || '';
      this.currentUserData.displayName = user?.name || '';
    });
  }

  private async getAnswersAmount() {
    const colRef = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}/thread`
    );
    collectionData(colRef).subscribe((data: any) => {
      this.answersAmount = data.length;
    });
  }

  public async handleNewMessage(textMessage: string) {
    if (!this.chatId || !this.messageId) return;

    const docRef = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}/thread/`
    );
    await addDoc(docRef, {
      user: this.currentUserData,
      text: textMessage,
      timestamp: serverTimestamp(),
    });
  }

  private getAllThreadMessages() {
    const messagesRef = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}/thread/`
    );
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    collectionData(q, { idField: 'id' }).subscribe((data: any) => {
      if (data.length > this.messages.length) {
        this.shouldScrollToBottom = true;
      }
      this.messages = data;
    });
  }

  public onClose() {
    this.close.emit();
    this.viewStateService.currentView = 'chat';
  }

  private scrollToBottom(): void {
    if (this.chatContent) {
      const element = this.chatContent.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth',
      });
    }
  }
}
