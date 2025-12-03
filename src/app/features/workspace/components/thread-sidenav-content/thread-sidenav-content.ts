import {
  AfterViewChecked,
  Component,
  ElementRef,
  EnvironmentInjector,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  runInInjectionContext,
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
import { ChannelService } from '../../../../../services/channel.service';
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
  private env = inject(EnvironmentInjector);

  /**
   * Wrapper for docData to run within injection context
   */
  private docData$<T>(docRef: any): any {
    return runInInjectionContext(this.env, () => docData(docRef));
  }

  /**
   * Wrapper for collectionData to run within injection context
   */
  private collectionData$<T>(query: any, options?: any): any {
    return runInInjectionContext(this.env, () => collectionData(query, options));
  }

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
    private channelService: ChannelService,
    public viewStateService: ViewStateService
  ) {}

  /**
   * Lifecycle hook: subscribes to current user data on component init.
   */
  ngOnInit(): void {
    this.subscribeToUserData();
  }

  /**
   * Lifecycle hook: auto-scrolls to bottom after view checks when flagged.
   */
  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  /**
   * Lifecycle hook: reacts to input changes by loading the trigger message,
   * thread messages, and current channel name.
   */
  ngOnChanges(): void {
    this.accessTriggerMessageData();
    this.getAllThreadMessages();
    this.getCurrentChannelName();
  }

  /**
   * Subscribes to channel name if the collection is `channels` and a `chatId` exists.
   * Uses cached ChannelService instead of direct docData listener (TIER 2, Fix 6)
   */
  private getCurrentChannelName() {
    if (this.collectionName !== 'channels' || !this.chatId) return;
    
    this.channelNameSub?.unsubscribe();
    this.channelNameSub = this.channelService.getChannel(this.chatId).subscribe((channelData: any) => {
      this.channelName = channelData?.name || 'unknown-channel';
    });
  }

  /**
   * Lifecycle hook: unsubscribes all active subscriptions to prevent leaks.
   */
  ngOnDestroy(): void {
    this.messageDataSub?.unsubscribe();
    this.userDataSub?.unsubscribe();
    this.answersAmountSub?.unsubscribe();
    this.answersDataSub?.unsubscribe();
    this.channelNameSub?.unsubscribe();
  }

  /**
   * Loads the selected trigger message and subscribes to its data and the current user.
   * No-op when `chatId` or `messageId` is missing.
   */
  private async accessTriggerMessageData() {
    if (!this.chatId || !this.messageId) return;
    this.subscribeToMessageData();
    this.subscribeToUserData();
  }

  /**
   * Subscribes to the selected message document and updates message details
   * like text, author, avatar, timestamp, reactions, and edit state.
   */
  private subscribeToMessageData() {
    this.messageDataSub?.unsubscribe();
    const messageDocRef = doc(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}`
    );
    this.messageDataSub = this.docData$(messageDocRef).subscribe((messageData: any) => {
      this.messageText = messageData.text || '';
      this.senderId = messageData.authorId || '';
      this.senderAvatar = messageData.authorAvatar || 'assets/img-profile/profile.png';
      this.senderName = messageData.authorName;
      this.messageTimestamp = messageData.timestamp || null;
      this.messageReactions = messageData.reactions || [];
      this.messageEdited = !!messageData.edited;
    });
  }

  /**
   * Subscribes to the current user and stores basic user info needed for threading.
   */
  private subscribeToUserData() {
    this.userDataSub?.unsubscribe();
    this.userDataSub = this.userService.currentUser$().subscribe((user: any) => {
      this.currentUserData.id = user?.uid || '';
      this.currentUserData.avatar = user?.avatar || '';
      this.currentUserData.displayName = user?.name || '';
    });
  }

  /**
   * Handles posting a new thread message beneath the trigger message.
   * No-op if `chatId` or `messageId` is missing.
   *
   * @param textMessage - The content of the thread message.
   */
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

  /**
   * Subscribes to all thread messages for the current trigger message,
   * keeps them ordered by timestamp, tracks count, and auto-scrolls on new entries.
   */
  private getAllThreadMessages() {
    this.answersDataSub?.unsubscribe();

    const messagesRef = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}/thread/`
    );
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    this.answersDataSub = this.collectionData$(q, { idField: 'id' }).subscribe((data: any) => {
      if (data.length > this.messages.length) {
        this.shouldScrollToBottom = true;
      }
      this.messages = data;
      this.answersAmount = data.length;
    });
  }

  /**
   * Emits close event and switches the view state back to the main chat.
   */
  public onClose() {
    this.close.emit();
    this.viewStateService.currentView = 'chat';
  }

  /**
   * Smoothly scrolls the thread content container to the bottom.
   */
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
