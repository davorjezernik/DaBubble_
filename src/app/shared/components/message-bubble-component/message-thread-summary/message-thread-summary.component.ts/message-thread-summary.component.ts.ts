import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { map, Subscription } from 'rxjs';

@Component({
  selector: 'app-message-thread-summary',
  imports: [CommonModule],
  templateUrl: './message-thread-summary.component.ts.html',
  styleUrl: './message-thread-summary.component.ts.scss',
})
export class MessageThreadSummaryComponent implements OnDestroy, OnChanges {
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() collectionName: 'channels' | 'dms' = 'dms';
  @Output() openThread = new EventEmitter<void>();

  lastTime: string = '';
  answersCount: number = 0;
  lastTimeSub?: Subscription;
  answersCountSub?: Subscription;

  constructor(private firestore: Firestore) {}

  ngOnDestroy(): void {
    this.answersCountSub?.unsubscribe();
    this.lastTimeSub?.unsubscribe();
  }

  ngOnChanges(changes: any): void {
    if (changes['messageId'] || changes['chatId'] || changes['collectionName']) {
      this.getAnswersInfo();
    }
  }

  onThreadClick(event: MouseEvent) {
  event.stopPropagation(); 
  this.openThread.emit(); 
}

  /** Load thread answers count and last answer timestamp. */
  private async getAnswersInfo() {
    if (!this.chatId || !this.messageId) return;

    const coll = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}/thread`
    );
    this.getAnswersAmount(coll);
    this.getLastAnswerTime(coll);
  }

  /** Subscribe to thread messages count. */
  private async getAnswersAmount(coll: any) {
    this.answersCountSub?.unsubscribe();
    this.answersCountSub = collectionData(coll)
      .pipe(map((docs) => docs.length))
      .subscribe((count) => {
        this.answersCount = count;
      });
  }

  /** Subscribe to latest thread answer timestamp. */
  private async getLastAnswerTime(coll: any) {
    this.lastTimeSub?.unsubscribe();
    this.lastTimeSub = collectionData(coll)
      .pipe(map((messages) => this.returnLastAnswerTime(messages)))
      .subscribe((timestamp) => {
        this.lastTime = timestamp;
      });
  }

  /** Extract the latest answer time from the thread messages. */
  private returnLastAnswerTime(messages: any[]): string {
    if (messages.length === 0) return '';
    const timestamps = messages
      .map((msg: any) => msg.timestamp?.toMillis())
      .filter((ts: any): ts is number => typeof ts === 'number');
    if (timestamps.length === 0) return '';
    const latest = Math.max(...timestamps);
    const latestDate = new Date(latest);
    return latestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}