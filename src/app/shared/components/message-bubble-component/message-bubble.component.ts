import { Component, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmojiPickerComponent } from '../../components/emoji-picker-component/emoji-picker-component';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss'
})
export class MessageBubbleComponent {
  @Input() incoming: boolean = false; // when true, render as left-side/incoming message
  @Input() name: string = 'Frederik Beck';
  @Input() time: string = '15:06 Uhr';
  @Input() avatar: string = 'assets/img-profile/frederik-beck.png';
  @Input() text: string = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.';

  showEmojiPicker = false;
  reactionsExpanded = false;

  isMoreMenuOpen = false;
  @Output() editMessage = new EventEmitter<void>();

  showMiniActions = false;
  private miniActionsHideTimer: any;

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  openEmojiPicker() {
    this.showEmojiPicker = true;
    this.showMiniActions = false;
  }

  onEmojiSelected(emoji: string) {
    this.addOrIncrementReaction(emoji);
    this.showEmojiPicker = false;
  }

  onClosePicker() {
    this.showEmojiPicker = false;
  }

  reactions: { emoji: string; count: number }[] = [];
  private readonly MAX_UNIQUE_REACTIONS = 20;
  private readonly DEFAULT_COLLAPSE_THRESHOLD = 7;
  private readonly NARROW_COLLAPSE_THRESHOLD = 6;

  isNarrow = typeof window !== 'undefined' ? window.innerWidth <= 450 : false;

  @HostListener('window:resize')
  onWindowResize() {
    this.isNarrow = typeof window !== 'undefined' ? window.innerWidth <= 450 : this.isNarrow;
  }

  addOrIncrementReaction(emoji: string) {
    const existing = this.reactions.find(r => r.emoji === emoji);
    if (existing) {
      existing.count += 1;
    } else {
      if (this.reactions.length >= this.MAX_UNIQUE_REACTIONS) {
        return;
      }
      this.reactions.push({ emoji, count: 1 });
    }
  }

  onClickReaction(emoji: string) {
    const idx = this.reactions.findIndex(r => r.emoji === emoji);
    if (idx > -1) {
      const r = this.reactions[idx];
      if (r.count > 1) {
        r.count -= 1;
      } else {
        this.reactions.splice(idx, 1);
      }
    }
  }

  get visibleReactions() {
    const total = this.reactions.length;
    const limit = this.reactionsExpanded ? this.MAX_UNIQUE_REACTIONS : this.getCollapseThreshold();
    return this.reactions.slice(0, Math.min(limit, total));
  }

  get hasMore() {
    return this.reactions.length > this.getCollapseThreshold();
  }

  get moreCount() {
    return Math.max(0, Math.min(this.reactions.length, this.MAX_UNIQUE_REACTIONS) - this.getCollapseThreshold());
  }

  showMore() { this.reactionsExpanded = true; }
  showLess() { this.reactionsExpanded = false; }

  private getCollapseThreshold(): number {
    return this.isNarrow ? this.NARROW_COLLAPSE_THRESHOLD : this.DEFAULT_COLLAPSE_THRESHOLD;
  }

  get shouldCenterNarrow(): boolean {
    return this.isNarrow && this.visibleReactions.length >= 2;
  }

  toggleMoreMenu(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.isMoreMenuOpen = !this.isMoreMenuOpen;
  }

  onEditMessage() {
    this.isMoreMenuOpen = false;
    this.editMessage.emit();
  }

  @HostListener('document:click')
  closeMenusOnOutsideClick() {
    if (this.isMoreMenuOpen) {
      this.isMoreMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeClose() {
    if (this.isMoreMenuOpen || this.showEmojiPicker) {
      this.isMoreMenuOpen = false;
      this.showEmojiPicker = false;
    }
  }

  onSpeechBubbleEnter() {
    this.clearMiniActionsHideTimer();
    this.showMiniActions = true;
  }

  onSpeechBubbleLeave() {
    this.startMiniActionsHideTimer();
  }

  onMiniActionsEnter() {
    this.clearMiniActionsHideTimer();
    this.showMiniActions = true;
  }

  onMiniActionsLeave() {
    this.startMiniActionsHideTimer();
  }

  private startMiniActionsHideTimer(delay = 180) {
    this.clearMiniActionsHideTimer();
    this.miniActionsHideTimer = setTimeout(() => {
      this.showMiniActions = false;
    }, delay);
  }

  private clearMiniActionsHideTimer() {
    if (this.miniActionsHideTimer) {
      clearTimeout(this.miniActionsHideTimer);
      this.miniActionsHideTimer = undefined;
    }
  }

  onQuickReact(emoji: string) {
    this.addOrIncrementReaction(emoji);
    this.showMiniActions = false;
  }

  onMiniAddReactionClick(event: MouseEvent) {
    event.stopPropagation();
    this.showMiniActions = false;
    setTimeout(() => {
      this.showEmojiPicker = true;
    });
  }
}
