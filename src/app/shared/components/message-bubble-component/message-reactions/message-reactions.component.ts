import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmojiPickerComponent } from '../../emoji-picker-component/emoji-picker-component';

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
  currentUserReacted: boolean;
  isLegacyCount: boolean;
}

@Component({
  selector: 'app-message-reactions',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent],
  templateUrl: './message-reactions.component.html',
  styleUrl: './message-reactions.component.scss'
})
export class MessageReactionsComponent {
  @Input() reactions: MessageReaction[] = [];
  @Input() isNarrow = false;
  @Input() isVeryNarrow = false;
  @Input() isMobile = false;
  @Input() maxReactions = 20;
  @Input() isDeleted = false;
  @Input() showEmojiPicker = false;
  @Input() defaultCollapseThreshold = 20;
  @Input() narrowCollapseThreshold = 7;
  @Input() veryNarrowCollapseThreshold = 7;

  @Output() reactionClick = new EventEmitter<string>();
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() toggleEmojiPicker = new EventEmitter<void>();
  @Output() closeEmojiPicker = new EventEmitter<void>();

  reactionsExpanded = false;
  tooltipVisibleForEmoji: string | null = null;

  /**
   * Subset of reactions to display based on expansion state and width.
   */
  get visibleReactions() {
    if (this.reactionsExpanded) {
      return this.reactions;
    }
    const limit = this.getCollapseThreshold();
    return this.reactions.slice(0, Math.min(limit, this.reactions.length));
  }

  /**
   * Whether there are hidden reactions beyond the collapsed limit.
   */
  get hasMore() {
    return this.reactions.length > this.getCollapseThreshold();
  }

  /**
   * Count of hidden reactions when collapsed (used in "+ n more").
   */
  get moreCount() {
    if (this.reactionsExpanded) return 0;
    return Math.max(0, this.reactions.length - this.getCollapseThreshold());
  }

  /**
   * Center reactions on narrow viewports when at least two chips are visible.
   */
  get shouldCenterNarrow(): boolean {
    return this.isNarrow && this.visibleReactions.length >= 2;
  }

  /** Expand the reactions list. */
  showMore() {
    this.reactionsExpanded = true;
  }

  /** Collapse the reactions list. */
  showLess() {
    this.reactionsExpanded = false;
  }

  /**
   * Compute the collapse threshold depending on viewport width.
   */
  private getCollapseThreshold(): number {
    if (this.isVeryNarrow) return this.veryNarrowCollapseThreshold;
    return this.isNarrow ? this.narrowCollapseThreshold : this.defaultCollapseThreshold;
  }

  /**
   * Emit when a reaction chip is clicked.
   */
  onReactionChipClick(emoji: string) {
    this.reactionClick.emit(emoji);
  }

  /**
   * Show tooltip for a reaction chip on hover (desktop only).
   */
  onReactionChipEnter(emoji: string) {
    if (this.isMobile) return;
    this.tooltipVisibleForEmoji = emoji;
  }

  /**
   * Hide reaction tooltip on mouse leave (desktop only).
   */
  onReactionChipLeave() {
    if (this.isMobile) return;
    this.tooltipVisibleForEmoji = null;
  }

  /**
   * Request opening of the add-reaction emoji picker.
   */
  onAddReactionClick() {
    this.toggleEmojiPicker.emit();
  }

  /**
   * Emit selected emoji from the picker.
   */
  onEmojiSelected(emoji: string) {
    this.emojiSelected.emit(emoji);
  }

  /**
   * Emit request to close the emoji picker.
   */
  onCloseEmojiPicker() {
    this.closeEmojiPicker.emit();
  }
}
