import { Component, EventEmitter, Input, Output, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ThreadOpenRequest {
  chatId: string;
  messageId: string;
  collectionName: 'channels' | 'dms';
}

/**
 * Mini actions bar that appears on hover/tap.
 * Provides quick access to reactions, emoji picker, reply, and more menu.
 */
@Component({
  selector: 'app-message-mini-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './message-mini-actions.component.html',
  styleUrl: './message-mini-actions.component.scss',
})
export class MessageMiniActionsComponent {
  private el = inject(ElementRef);

  /** Whether the mini actions bar is visible */
  @Input() visible = false;

  /** Whether the more menu (three dots) is currently open */
  @Input() isMoreMenuOpen = false;

  /** Whether this is displayed in thread view (hides some actions) */
  @Input() isThreadView = false;

  /** Whether the message is deleted (disables actions) */
  @Input() isDeleted = false;

  /** Whether on mobile viewport (changes hover behavior) */
  @Input() isMobile = false;

  /** Chat ID for thread opening */
  @Input() chatId?: string;

  /** Message ID for thread opening */
  @Input() messageId?: string;

  /** Collection name for thread opening */
  @Input() collectionName: 'channels' | 'dms' = 'dms';

  /** Firestore path for reaction management */
  @Input() messagePath: string | null = null;

  /** Current user ID for reactions */
  @Input() currentUserId: string | null = null;

  /** Emitted when quick reaction button is clicked with emoji */
  @Output() quickReact = new EventEmitter<string>();

  /** Emitted when add reaction button is clicked */
  @Output() addReaction = new EventEmitter<void>();

  /** Emitted when reply/comment button should open thread */
  @Output() openThread = new EventEmitter<ThreadOpenRequest>();

  /** Emitted when visibility should change */
  @Output() visibilityChange = new EventEmitter<boolean>();

  /** Emitted when more menu should close */
  @Output() closeMoreMenu = new EventEmitter<void>();

  /** Quick-add a reaction via the mini actions bar and close the bar */
  onQuickReact(emoji: string) {
    if (this.isDeleted || !this.currentUserId) return;
    this.quickReact.emit(emoji);
    this.visibilityChange.emit(false);
  }

  /** Show the reactions emoji picker from the mini actions bar */
  onAddReactionClick(event: MouseEvent) {
    if (this.isDeleted) return;
    event.stopPropagation();
    this.visibilityChange.emit(false);
    this.addReaction.emit();
  }

  /** Handle reply button click - opens thread panel */
  onReplyClick() {
    if (this.isDeleted) return;
    this.visibilityChange.emit(false);
    if (!this.chatId || !this.messageId) return;
    
    this.openThread.emit({
      chatId: this.chatId,
      messageId: this.messageId,
      collectionName: this.collectionName,
    });
  }

  /** Keep mini actions visible while hovering over them */
  onMouseEnter() {
    if (this.isDeleted || this.isMobile) return;
    this.visibilityChange.emit(true);
  }

  /** Hide when leaving mini actions AND not moving back to parent container */
  onMouseLeave(event: MouseEvent) {
    if (this.isMobile) return;
    const next = event.relatedTarget as HTMLElement | null;
    
    // Check if moving to parent message-container
    const parentComponent = this.el.nativeElement.closest('.message-container') as HTMLElement | null;
    if (next && parentComponent && parentComponent.contains(next)) return;
    
    this.visibilityChange.emit(false);
    this.closeMoreMenu.emit();
  }
}
