import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, EnvironmentInjector, inject } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { collection, Firestore, query, orderBy, limit, getCountFromServer, getDocs } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

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
  private env = inject(EnvironmentInjector);

  constructor(private firestore: Firestore) {}

  /**
   * Wrapper for getCountFromServer to run within injection context
   */
  private async getCountFromServer$(query: any): Promise<any> {
    return runInInjectionContext(this.env, () => getCountFromServer(query));
  }

  /**
   * Wrapper for getDocs to run within injection context
   */
  private async getDocs$(query: any): Promise<any> {
    return runInInjectionContext(this.env, () => getDocs(query));
  }

  ngOnDestroy(): void {
    // Keine Subscriptions mehr zu cleanup
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
    await this.getAnswersAmount(coll);
    await this.getLastAnswerTime(coll);
  }

  /**
   * One-time Read für Thread Count (TIER 1, Fix 4)
   * Verwendet getCountFromServer() statt Real-time Listener
   */
  private async getAnswersAmount(coll: any) {
    try {
      const snapshot = await this.getCountFromServer$(query(coll));
      this.answersCount = snapshot.data().count;
    } catch (error) {
      console.warn('Failed to get thread count:', error);
      this.answersCount = 0;
    }
  }

  /**
   * One-time Read für letzten Thread-Timestamp (TIER 1, Fix 4)
   * Verwendet getDocs() mit limit(1) statt Real-time Listener
   */
  private async getLastAnswerTime(coll: any) {
    try {
      const q = query(coll, orderBy('timestamp', 'desc'), limit(1));
      const snapshot = await this.getDocs$(q);
      
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as any;
        const timestamp = docData['timestamp'];
        this.lastTime = this.formatTimestamp(timestamp);
      } else {
        this.lastTime = '';
      }
    } catch (error) {
      console.warn('Failed to get last thread time:', error);
      this.lastTime = '';
    }
  }

  /** Format Firestore timestamp to time string. */
  private formatTimestamp(timestamp: any): string {
    if (!timestamp) return '';
    const millis = timestamp?.toMillis ? timestamp.toMillis() : timestamp;
    if (typeof millis !== 'number') return '';
    const date = new Date(millis);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}