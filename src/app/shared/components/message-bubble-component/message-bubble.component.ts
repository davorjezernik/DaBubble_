import {
  Component,
  HostListener,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThreadPanelService } from '../../../../services/thread-panel.service';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import {
  Firestore,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from '@angular/fire/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { AuthService } from '../../../../services/auth-service';

export interface Reaction {
  emoji: string;
  count: number;
  users: { id: string; name: string }[];
  currentUserReacted: boolean;
}

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss',
})
export class MessageBubbleComponent implements OnChanges {
  @ViewChild('editEmojiPicker', { read: ElementRef })
  editEmojiPickerRef?: ElementRef;
  @ViewChild('editEmojiButton', { read: ElementRef })
  editEmojiButtonRef?: ElementRef;

  @Input() incoming: boolean = false; // when true, render as left-side/incoming message
  @Input() name: string = 'Frederik Beck';
  @Input() time: string = '15:06 Uhr';
  @Input() avatar: string = 'assets/img-profile/frederik-beck.png';
  @Input() text: string =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.';
  // Persistence wiring
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() reactionsMap?:
    | Record<string, { users: { id: string; name: string }[] }>
    | null;
  @Input() collectionName: 'channels' | 'dms' = 'dms';
  @Input() lastReplyAt?: unknown;
  @Input() context: 'chat' | 'thread' = 'chat';
  @Input() isThreadView: boolean = false;

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
  editEmojiPickerVisible = false;
  currentUser: FirebaseUser | null = null;

  /**
   * Toggle the inline emoji picker for quick reactions.
   * Uses: showEmojiPicker (boolean) – controls visibility of the picker.
   */
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  /**
   * Open the reactions emoji picker and hide mini actions.
   * Affects: showEmojiPicker (true), showMiniActions (false).
   */
  openEmojiPicker() {
    this.showEmojiPicker = true;
    this.showMiniActions = false;
  }

  /**
   * Handle a selected emoji from the reactions picker.
   * @param emoji The unicode emoji string to add or increment.
   * Side effects: updates reactions array and closes picker.
   */
  onEmojiSelected(emoji: string) {
    this.addOrIncrementReaction(emoji);
    this.showEmojiPicker = false;
  }

  /**
   * Close the reactions emoji picker.
   */
  onClosePicker() {
    this.showEmojiPicker = false;
  }

  /**
   * Toggle the edit-mode emoji picker next to the textarea.
   * @param event Optional MouseEvent to stop propagation (prevents immediate close from document listener).
   * Uses: editEmojiPickerVisible (boolean) – controls visibility in edit mode.
   */
  toggleEditEmojiPicker(event?: MouseEvent) {
    event?.stopPropagation();
    this.editEmojiPickerVisible = !this.editEmojiPickerVisible;
  }

  /**
   * Close the edit-mode emoji picker.
   */
  closeEditEmojiPicker() {
    this.editEmojiPickerVisible = false;
  }

  /**
   * Add selected emoji into the edit textarea content.
   * @param emoji The unicode emoji string to append to editText.
   * Uses: editText (string) – current editable text buffer.
   */
  onEditEmojiSelected(emoji: string) {
    this.editText = (this.editText || '') + emoji;
    this.editEmojiPickerVisible = false;
  }

  reactions: Reaction[] = [];
  private readonly MAX_UNIQUE_REACTIONS = 20;
  private readonly DEFAULT_COLLAPSE_THRESHOLD = 7;
  private readonly NARROW_COLLAPSE_THRESHOLD = 6;

  isNarrow = typeof window !== 'undefined' ? window.innerWidth <= 450 : false;

  @HostListener('window:resize')
  onWindowResize() {
    this.isNarrow =
      typeof window !== 'undefined' ? window.innerWidth <= 450 : this.isNarrow;
  }

  /**
   * React to input changes from parent.
   * Currently maps reactionsMap (Record<emoji, count>) into reactions array for rendering.
   * @param changes Angular SimpleChanges for this component.
   */

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.updateReactions(); // Re-process reactions if user changes
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('reactionsMap' in changes) {
      this.updateReactions();
    }
  }

  private updateReactions() {
    const map = this.reactionsMap || {};
    const currentUserId = this.currentUser?.uid;

    this.reactions = Object.entries(map)
      .map(([emoji, data]) => {
        const users = data.users || [];
        return {
          emoji,
          users: users,
          count: users.length,
          currentUserReacted: users.some((u) => u.id === currentUserId),
        };
      })
      .filter((r) => r.count > 0) // Filter out reactions with no users
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Add a new reaction or increment an existing one.
   * @param emoji The emoji key to add/increment.
   * Uses: reactions (local array), MAX_UNIQUE_REACTIONS, persistReactionDelta(...) for Firestore sync.
   */
  addOrIncrementReaction(emoji: string) {
    if (!this.currentUser) return;

    const existing = this.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (!existing.currentUserReacted) {
        this.persistReaction(emoji, 'add');
      }
    } else if (this.reactions.length < this.MAX_UNIQUE_REACTIONS) {
      this.persistReaction(emoji, 'add');
    }
  }

  /**
   * Click handler for a reaction chip: decrements or removes when count hits zero.
   * @param emoji The emoji key to decrement/remove.
   */
  onClickReaction(emoji: string) {
    if (!this.currentUser) return;

    const reaction = this.reactions.find((r) => r.emoji === emoji);
    if (!reaction) return;

    if (reaction.currentUserReacted) {
      this.persistReaction(emoji, 'remove');
    } else {
      this.persistReaction(emoji, 'add');
    }
  }

  /**
   * Subset of reactions to display based on expansion state and width.
   */
  get visibleReactions() {
    const total = this.reactions.length;
    const limit = this.reactionsExpanded
      ? this.MAX_UNIQUE_REACTIONS
      : this.getCollapseThreshold();
    return this.reactions.slice(0, Math.min(limit, total));
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
    return Math.max(
      0,
      Math.min(this.reactions.length, this.MAX_UNIQUE_REACTIONS) -
        this.getCollapseThreshold()
    );
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
   * Returns DEFAULT or NARROW threshold.
   */
  private getCollapseThreshold(): number {
    return this.isNarrow
      ? this.NARROW_COLLAPSE_THRESHOLD
      : this.DEFAULT_COLLAPSE_THRESHOLD;
  }

  /**
   * Center reactions on narrow viewports when at least two chips are visible.
   */
  get shouldCenterNarrow(): boolean {
    return this.isNarrow && this.visibleReactions.length >= 2;
  }
  /**
   * Normalize last reply timestamp to a Date.
   * Accepts Date, Firestore Timestamp (with toDate), or ISO string/epoch number.
   */
  get lastReplyDate(): Date | null {
    const v: any = this.lastReplyAt as any;
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') {
      try {
        return v.toDate();
      } catch {
        return null;
      }
    }
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /**
   * Toggle the 3-dots context menu.
   * @param event Optional MouseEvent to stop propagation and prevent default.
   */
  toggleMoreMenu(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.isMoreMenuOpen = !this.isMoreMenuOpen;
  }

  /**
   * Start inline edit mode for this message.
   * Closes the menu and prepares editText buffer from current text.
   */
  onEditMessage() {
    this.isMoreMenuOpen = false;
    this.startEdit();
  }

  @HostListener('document:click', ['$event'])
  /**
   * Global click handler:
   * - Closes the 3-dots menu
   * - Closes the edit-mode emoji picker if click is outside button/picker
   * @param event The click event target to test containment.
   */
  onDocumentClick(event: Event) {
    if (this.isMoreMenuOpen) {
      this.isMoreMenuOpen = false;
    }

    if (this.editEmojiPickerVisible) {
      const clickedInsideButton =
        this.editEmojiButtonRef?.nativeElement.contains(event.target);
      const clickedInsidePicker =
        this.editEmojiPickerRef?.nativeElement.contains(event.target);

      if (!clickedInsideButton && !clickedInsidePicker) {
        this.closeEditEmojiPicker();
      }
    }
  }

  @HostListener('document:keydown.escape')
  /**
   * Global ESC handler: closes menus and emoji pickers.
   */
  onEscapeClose() {
    if (this.isMoreMenuOpen || this.showEmojiPicker) {
      this.isMoreMenuOpen = false;
      this.showEmojiPicker = false;
    }
    if (this.editEmojiPickerVisible) {
      this.editEmojiPickerVisible = false;
    }
  }

  /** Show mini actions when cursor enters the bubble. */
  onSpeechBubbleEnter() {
    this.clearMiniActionsHideTimer();
    this.showMiniActions = true;
  }

  /**
   * Start timer to hide mini actions when cursor leaves.
   * Also closes 3-dots menu and reaction picker.
   */
  onSpeechBubbleLeave() {
    this.startMiniActionsHideTimer();
    this.isMoreMenuOpen = false;
    // this.showEmojiPicker = false; // Do not hide picker here, it causes a race condition
  }

  /** Keep mini actions visible while hovering over them. */
  onMiniActionsEnter() {
    this.clearMiniActionsHideTimer();
    this.showMiniActions = true;
  }

  /** Hide mini actions shortly after leaving the mini actions area. */
  onMiniActionsLeave() {
    this.startMiniActionsHideTimer();
    this.isMoreMenuOpen = false;
  }

  /**
   * Start a short timeout to hide the mini actions bar.
   * @param delay Timeout in ms (default 180). Uses miniActionsHideTimer to manage the timer id.
   */
  private startMiniActionsHideTimer(delay = 180) {
    this.clearMiniActionsHideTimer();
    this.miniActionsHideTimer = setTimeout(() => {
      this.showMiniActions = false;
    }, delay);
  }

  /** Clear and reset the mini actions hide timer if running. */
  private clearMiniActionsHideTimer() {
    if (this.miniActionsHideTimer) {
      clearTimeout(this.miniActionsHideTimer);
      this.miniActionsHideTimer = undefined;
    }
  }

  /**
   * Enter editing mode: show textarea and preload editText with current text.
   */
  startEdit() {
    this.isEditing = true;
    this.showMiniActions = false;
    this.editText = this.text || '';
  }

  /** Exit editing mode without saving. */
  cancelEdit() {
    this.isEditing = false;
  }

  /**
   * Save the edited message text to Firestore (doc/updateDoc) if identifiers are present.
   * Validates non-empty trimmed text; updates local UI optimistically.
   */
  async saveEdit() {
    if (!this.chatId || !this.messageId) {
      this.isEditing = false;
      return;
    }
    const newText = (this.editText ?? '').trim();
    if (!newText) {
      this.isEditing = false;
      return;
    }
    try {
      this.isSaving = true;
      const ref = doc(
        this.firestore,
        `${this.collectionName}/${this.chatId}/messages/${this.messageId}`
      );
      await updateDoc(ref, { text: newText });
      this.text = newText;
      this.isEditing = false;
    } catch (e) {
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Delete this message from Firestore (doc/deleteDoc) after user confirmation.
   * Uses isDeleting flag to disable buttons while in-flight.
   */
  async deleteMessage() {
    if (!this.chatId || !this.messageId) return;
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm('Nachricht wirklich löschen?')
        : true;
    if (!confirmed) return;
    try {
      this.isDeleting = true;
      const ref = doc(
        this.firestore,
        `${this.collectionName}/${this.chatId}/messages/${this.messageId}`
      );
      await deleteDoc(ref);
    } catch (e) {
      // noop
    } finally {
      this.isDeleting = false;
    }
  }

  /** Quick-add a reaction via the mini actions bar and close the bar. */
  onQuickReact(emoji: string) {
    this.addOrIncrementReaction(emoji);
    this.showMiniActions = false;
  }

  /**
   * Show the reactions emoji picker from the mini actions bar.
   * @param event MouseEvent – stopped to avoid closing from document click.
   * Uses setTimeout to open after mini actions hide state is applied.
   */
  onMiniAddReactionClick(event: MouseEvent) {
    event.stopPropagation();
    this.showMiniActions = false;
    this.toggleEmojiPicker();
  }

  /**
   * Open the side thread panel for this message.
   * @param event MouseEvent – stopped to prevent bubbling to container.
   * Requires chatId and messageId; uses threadPanel.openThread(...).
   */
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

  /**
   * Persist reaction change to Firestore using atomic updates.
   * @param emoji Emoji key in the map (stored as reactions.<emoji> field path).
   * @param action 'add' to add the current user, 'remove' to remove them.
   */
  private async persistReaction(emoji: string, action: 'add' | 'remove') {
    if (!this.chatId || !this.messageId || !this.currentUser) return;

    try {
      const ref = doc(
        this.firestore,
        `${this.collectionName}/${this.chatId}/messages/${this.messageId}`
      );
      const fieldPath = `reactions.${emoji}.users`;
      const userPayload = {
        id: this.currentUser.uid,
        name: this.currentUser.displayName || 'Unknown User',
      };

      if (action === 'add') {
        await updateDoc(ref, { [fieldPath]: arrayUnion(userPayload) });
      } else {
        await updateDoc(ref, { [fieldPath]: arrayRemove(userPayload) });
      }
    } catch (e) {
      console.error('Failed to persist reaction:', e);
    }
  }

  @HostListener('mouseleave')
  onHostLeave() {
    this.onClosePicker();
  }

  /**
   * DI constructor.
   * @param firestore AngularFire Firestore instance used for message updates/deletes and reactions.
   * @param threadPanel Service to open the thread side panel for a given message.
   */
  constructor(
    private firestore: Firestore,
    private threadPanel: ThreadPanelService,
    private authService: AuthService
  ) {}
}
