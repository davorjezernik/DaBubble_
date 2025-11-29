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

  @Input() visible = false;
  @Input() isMoreMenuOpen = false;
  @Input() isThreadView = false;
  @Input() isDeleted = false;
  @Input() isMobile = false;
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() collectionName: 'channels' | 'dms' = 'dms';
  @Input() messagePath: string | null = null;
  @Input() currentUserId: string | null = null;
  @Output() quickReact = new EventEmitter<string>();
  @Output() addReaction = new EventEmitter<void>();
  @Output() openThread = new EventEmitter<ThreadOpenRequest>();
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() closeMoreMenu = new EventEmitter<void>();
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
