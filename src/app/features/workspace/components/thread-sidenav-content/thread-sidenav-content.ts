import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';
import { UserService } from '../../../../../services/user.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-thread-sidenav-content',
  standalone: true,
  imports: [MessageAreaComponent, MessageBubbleComponent, DatePipe],
  templateUrl: './thread-sidenav-content.html',
  styleUrl: './thread-sidenav-content.scss',
})
export class ThreadSidenavContent implements OnInit, OnDestroy, OnChanges {
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() collectionName: 'channels' | 'dms' = 'dms';

  @Output() close = new EventEmitter<void>();

  messageText: string | null = '';
  senderId: string = '';
  messageTimestamp: any;
  messageReactions?: Record<string, number>;

  currentUserData = {
    id: '',
    avatar: '' as string | null,
    displayName: '' as string,
  };

  messageDataSub?: Subscription;
  userDataSub?: Subscription;

  constructor(private firestore: Firestore, private userService: UserService) {}

  ngOnInit(): void {}

  ngOnChanges(): void {
    this.accessTriggerMessageData();
  }

  ngOnDestroy(): void {
    this.messageDataSub?.unsubscribe();
    this.userDataSub?.unsubscribe();
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
      this.messageTimestamp = messageData.timestamp || null;
      this.messageReactions = messageData.reactions || [];
    });
  }

  private subscribeToUserData() {
    this.userDataSub = this.userService.currentUser$().subscribe((user: any) => {
      this.currentUserData.id = user?.uid || '';
      this.currentUserData.avatar = user?.avatar || '';
      this.currentUserData.displayName = user?.name || '';
    });
  }

  onClose() {
    this.close.emit();
  }
}
