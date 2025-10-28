import { Component, HostListener, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
// ...
import { ThreadPanelService } from '../../../../services/thread-panel.service';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import { Firestore, doc, updateDoc, deleteDoc, deleteField, increment } from '@angular/fire/firestore';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss'
})
export class MessageBubbleComponent implements OnChanges {
  @ViewChild('editEmojiPicker', { read: ElementRef }) editEmojiPickerRef?: ElementRef;
  @ViewChild('editEmojiButton', { read: ElementRef }) editEmojiButtonRef?: ElementRef;
  // Incoming alignment is provided by parent via [incoming]

  @Input() incoming: boolean = false; // when true, render as left-side/incoming message
  @Input() name: string = 'Frederik Beck';
  @Input() time: string = '15:06 Uhr';
  @Input() avatar: string = 'assets/img-profile/frederik-beck.png';
  @Input() text: string = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.';
  // Persistence wiring
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() reactionsMap?: Record<string, number> | null;
  // Collection context for reactions persistence (defaults to 'dms' for backward compatibility)
  @Input() collectionName: 'channels' | 'dms' = 'dms';
  // Optional thread meta: pass last reply timestamp (Date | Firestore Timestamp | ISO string)
  @Input() lastReplyAt?: unknown;

  showEmojiPicker = false;
  reactionsExpanded = false;

  isMoreMenuOpen = false;
  @Output() editMessage = new EventEmitter<void>();

  showMiniActions = false;
  private miniActionsHideTimer: any;
  isEditing = false;
  editText = '';
  isSaving = false;
  isDeleting = false;
  // Edit mode emoji picker state
  editEmojiPickerVisible = false;

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

  // Edit mode emoji picker handlers
  toggleEditEmojiPicker(event?: MouseEvent) {
    // Prevent the document click listener from closing the picker immediately
    event?.stopPropagation();
    this.editEmojiPickerVisible = !this.editEmojiPickerVisible;
  }

  closeEditEmojiPicker() {
    this.editEmojiPickerVisible = false;
  }

  onEditEmojiSelected(emoji: string) {
    // Append emoji to current edit text
    this.editText = (this.editText || '') + emoji;
    this.editEmojiPickerVisible = false;
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

  ngOnChanges(changes: SimpleChanges) {
    if ('reactionsMap' in changes) {
      const map = this.reactionsMap || {};
      this.reactions = Object.entries(map)
        .filter(([_, v]) => typeof v === 'number' && v > 0)
        .map(([emoji, count]) => ({ emoji, count: Number(count) }));
    }
  }

  addOrIncrementReaction(emoji: string) {
    const existing = this.reactions.find(r => r.emoji === emoji);
    if (existing) {
      existing.count += 1;
      this.persistReactionDelta(emoji, +1, existing.count);
    } else {
      if (this.reactions.length >= this.MAX_UNIQUE_REACTIONS) {
        return;
      }
      this.reactions.push({ emoji, count: 1 });
      this.persistReactionDelta(emoji, +1, 1);
    }
  }

  onClickReaction(emoji: string) {
    const idx = this.reactions.findIndex(r => r.emoji === emoji);
    if (idx > -1) {
      const r = this.reactions[idx];
      if (r.count > 1) {
        r.count -= 1;
        this.persistReactionDelta(emoji, -1, r.count);
      } else {
        this.reactions.splice(idx, 1);
        this.persistReactionDelta(emoji, -1, 0);
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

  // Normalize various timestamp shapes (Date, Firestore Timestamp, ISO string)
  get lastReplyDate(): Date | null {
    const v: any = this.lastReplyAt as any;
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') {
      try { return v.toDate(); } catch { return null; }
    }
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
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
    // Switch to inline edit mode
    this.startEdit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.isMoreMenuOpen) {
      this.isMoreMenuOpen = false;
    }

    if (this.editEmojiPickerVisible) {
      const clickedInsideButton = this.editEmojiButtonRef?.nativeElement.contains(event.target);
      const clickedInsidePicker = this.editEmojiPickerRef?.nativeElement.contains(event.target);

      if (!clickedInsideButton && !clickedInsidePicker) {
        this.closeEditEmojiPicker();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeClose() {
    if (this.isMoreMenuOpen || this.showEmojiPicker) {
      this.isMoreMenuOpen = false;
      this.showEmojiPicker = false;
    }
    if (this.editEmojiPickerVisible) {
      this.editEmojiPickerVisible = false;
    }
  }

  onSpeechBubbleEnter() {
    this.clearMiniActionsHideTimer();
    this.showMiniActions = true;
  }

  onSpeechBubbleLeave() {
    // Hide mini actions and ensure the 3-dots menu is closed when leaving the bubble
    this.startMiniActionsHideTimer();
    this.isMoreMenuOpen = false;
    this.showEmojiPicker = false;
  }

  onMiniActionsEnter() {
    this.clearMiniActionsHideTimer();
    this.showMiniActions = true;
  }

  onMiniActionsLeave() {
    // Also close the 3-dots menu when leaving the mini actions area
    this.startMiniActionsHideTimer();
    this.isMoreMenuOpen = false;
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

  startEdit() {
    this.isEditing = true;
    this.showMiniActions = false;
    this.editText = this.text || '';
  }

  cancelEdit() {
    this.isEditing = false;
  }

  async saveEdit() {
    if (!this.chatId || !this.messageId) {
      this.isEditing = false;
      return;
    }
    const newText = (this.editText ?? '').trim();
    if (!newText) {
      // Leere Nachricht nicht speichern; optional könnte man hier löschen anbieten
      this.isEditing = false;
      return;
    }
    try {
      this.isSaving = true;
      const ref = doc(this.firestore, `${this.collectionName}/${this.chatId}/messages/${this.messageId}`);
      await updateDoc(ref, { text: newText });
      // Optimistische Aktualisierung bis der Stream aktualisiert
      this.text = newText;
      this.isEditing = false;
    } catch (e) {
      // console.warn('saveEdit failed', e);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteMessage() {
    if (!this.chatId || !this.messageId) return;
    // Simple confirm; could be replaced by a dialog component
    const confirmed = typeof window !== 'undefined' ? window.confirm('Nachricht wirklich löschen?') : true;
    if (!confirmed) return;
    try {
      this.isDeleting = true;
      const ref = doc(this.firestore, `${this.collectionName}/${this.chatId}/messages/${this.messageId}`);
      await deleteDoc(ref);
    } catch (e) {
      // noop
    } finally {
      this.isDeleting = false;
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

  onCommentClick(event: MouseEvent) {
    event.stopPropagation();
    this.showMiniActions = false;
    if (!this.chatId || !this.messageId) return;
    this.threadPanel.openThread({
      chatId: this.chatId,
      messageId: this.messageId,
      collectionName: this.collectionName,
    });
  }

  private async persistReactionDelta(emoji: string, delta: number, newCount: number) {
    // Only persist if we have identifiers
    if (!this.chatId || !this.messageId) return;
    try {
      const ref = doc(
        this.firestore,
        `${this.collectionName}/${this.chatId}/messages/${this.messageId}`
      );
      const fieldPath = `reactions.${emoji}`;
      if (newCount <= 0) {
        await updateDoc(ref, { [fieldPath]: deleteField() });
      } else {
        await updateDoc(ref, { [fieldPath]: increment(delta) });
      }
    } catch (e) {
      // swallow errors for now; could add retry/notification
      // console.warn('persistReactionDelta failed', e);
    }
  }

  constructor(private firestore: Firestore, private threadPanel: ThreadPanelService) {}
}
