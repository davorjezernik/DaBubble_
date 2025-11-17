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
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThreadPanelService } from '../../../../services/thread-panel.service';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import {
  Firestore,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  increment,
  collection,
  collectionData,
} from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';
import { ViewStateService } from '../../../../services/view-state.service';
import { MatDialog } from '@angular/material/dialog';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';
import { firstValueFrom, map, Subscription } from 'rxjs';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss',
})
export class MessageBubbleComponent implements OnChanges, OnDestroy {
  @ViewChild('editEmojiPicker', { read: ElementRef }) editEmojiPickerRef?: ElementRef;
  @ViewChild('editEmojiButton', { read: ElementRef }) editEmojiButtonRef?: ElementRef;
  @ViewChild('editTextarea', { read: ElementRef }) editTextareaRef?: ElementRef<HTMLTextAreaElement>;

  @Input() incoming: boolean = false; // when true, render as left-side/incoming message
  @Input() name: string = 'Frederik Beck';
  @Input() time: string = '15:06 Uhr';
  @Input() avatar: string = 'assets/img-profile/frederik-beck.png';
  @Input() text: string =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.';
  // Persistence wiring
  @Input() chatId?: string;
  @Input() messageId?: string;
  // For thread replies: parent/root message id of the thread
  @Input() parentMessageId?: string;
  // reactions can be legacy number (count) or a map of uid->true per emoji
  @Input() reactionsMap?: Record<string, number | Record<string, true>> | null;
  @Input() collectionName: 'channels' | 'dms' = 'dms';
  @Input() lastReplyAt?: unknown;
  @Input() context: 'chat' | 'thread' = 'chat';
  @Input() isThreadView: boolean = false;
  /** When true, show an "Bearbeitet" label in the header (set by parent or via saveEdit). */
  @Input() edited?: boolean;
  /** Author user id for opening profile card on name click. */
  @Input() authorId?: string;

  showEmojiPicker = false;
  reactionsExpanded = false;
  isMoreMenuOpen = false;
  @Output() editMessage = new EventEmitter<void>();

  showMiniActions = false;
  isEditing = false;
  editText = '';
  isSaving = false;
  isDeleting = false;
  editEmojiPickerVisible = false;
  private readonly DELETED_PLACEHOLDER = 'Diese Nachricht wurde gelöscht.';
  // Delete confirmation UI state
  confirmDeleteOpen = false;

  lastTime: string = '';
  answersCount: number = 0;
  lastTimeSub?: Subscription;
  answersCountSub?: Subscription;

  /**
   * Toggle the inline emoji picker for quick reactions.
   * Uses: showEmojiPicker (boolean) – controls visibility of the picker.
   */
  toggleEmojiPicker() {
    if (this.isDeleted) return;
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  /**
   * Build Firestore doc path for this message depending on context.
   * - Normal chat: {collectionName}/{chatId}/messages/{messageId}
   * - Thread reply: {collectionName}/{chatId}/messages/{parentMessageId}/thread/{messageId}
   */
  private buildMessageDocPath(): string | null {
    if (!this.collectionName || !this.chatId || !this.messageId) return null;
    if (this.isThreadView && this.parentMessageId) {
      return `${this.collectionName}/${this.chatId}/messages/${this.parentMessageId}/thread/${this.messageId}`;
    }
    return `${this.collectionName}/${this.chatId}/messages/${this.messageId}`;
  }


  /**
   * Open the reactions emoji picker and hide mini actions.
   * Affects: showEmojiPicker (true), showMiniActions (false).
   */
  openEmojiPicker() {
    if (this.isDeleted) return;
    this.showEmojiPicker = true;
    this.showMiniActions = false;
  }

  /** Display name truncated per 12/12 rule (first and last name). */
  get displayName(): string {
    return this.truncateFullName(this.name || '');
  }

  /**
   * Handle a selected emoji from the reactions picker.
   * @param emoji The unicode emoji string to add or increment.
   * Side effects: updates reactions array and closes picker.
   */
  onEmojiSelected(emoji: string) {
    if (this.isDeleted) return;
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
    this.autosizeEditTextarea();
  }

  /** Input handler for the edit textarea: updates text and auto-grows the field. */
  onEditInput(event: Event) {
    const target = event.target as HTMLTextAreaElement | null;
    this.editText = target?.value ?? '';
    this.autosizeEditTextarea();
  }

  /** Resize the edit textarea to fit content without scrollbar. */
  private autosizeEditTextarea() {
    const el = this.editTextareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  reactions: Array<{
    emoji: string;
    count: number;
    userIds: string[];
    userNames: string[];
    currentUserReacted: boolean;
    isLegacyCount: boolean;
  }> = [];
  private nameCache = new Map<string, string>();
  private subscribedUids = new Set<string>();
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private readonly MAX_UNIQUE_REACTIONS = 20;
  private readonly DEFAULT_COLLAPSE_THRESHOLD = 7;
  private readonly NARROW_COLLAPSE_THRESHOLD = 6;
  private readonly VERY_NARROW_COLLAPSE_THRESHOLD = 4; // <= 400px

  // Long press state for reaction tooltips on mobile
  private longPressTimer: any;
  tooltipVisibleForEmoji: string | null = null;

  isNarrow = typeof window !== 'undefined' ? window.innerWidth <= 450 : false;
  isVeryNarrow = typeof window !== 'undefined' ? window.innerWidth <= 400 : false;
  isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

  @HostListener('window:resize')
  onWindowResize() {
    if (typeof window !== 'undefined') {
      this.isNarrow = window.innerWidth <= 450;
      this.isVeryNarrow = window.innerWidth <= 400;
      this.isMobile = window.innerWidth <= 768;
    }
  }

  /**
   * React to input changes from parent.
   * Currently maps reactionsMap (Record<emoji, count>) into reactions array for rendering.
   * @param changes Angular SimpleChanges for this component.
   */

  ngOnInit(): void {
    // track current user for toggling and display
    this.userService.currentUser$().subscribe((u: any) => {
      this.currentUserId = u?.uid ?? null;
      this.currentUserName = (u?.name ?? '').toString();
      // re-evaluate reactions when user changes (for currentUserReacted)
      this.rebuildReactions();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('reactionsMap' in changes) {
      this.rebuildReactions();
    }
    this.getAnswersInfo();
  }

  ngOnDestroy(): void {
    this.answersCountSub?.unsubscribe();
  }

  private rebuildReactions() {
    const map = this.reactionsMap || {};
    const uid = this.currentUserId;
    const out: typeof this.reactions = [];
    for (const [emoji, value] of Object.entries(map)) {
      if (typeof value === 'number') {
        const count = Math.max(0, Number(value));
        if (count > 0) {
          out.push({
            emoji,
            count,
            userIds: [],
            userNames: [],
            currentUserReacted: false,
            isLegacyCount: true,
          });
        }
      } else if (value && typeof value === 'object') {
        const userIds = Object.keys(value as Record<string, true>);
        const count = userIds.length;
        if (count > 0) {
          // prefetch names
          this.ensureNamesLoaded(userIds);
          const userNames = userIds.map((id) => this.truncateFullName(this.nameCache.get(id) || ''));
          out.push({
            emoji,
            count,
            userIds,
            userNames,
            currentUserReacted: !!uid && userIds.includes(uid),
            isLegacyCount: false,
          });
        }
      }
    }
    // sort by count desc (optional)
    this.reactions = out.sort((a, b) => b.count - a.count);
  }

  private ensureNamesLoaded(uids: string[]) {
    for (const id of uids) {
      if (this.nameCache.has(id) || this.subscribedUids.has(id)) continue;
      this.subscribedUids.add(id);
      this.userService.userById$(id).subscribe((u: any) => {
        if (u) this.nameCache.set(id, String(u.name ?? ''));
        // refresh names in current reactions
        this.reactions = this.reactions.map((r) =>
          r.userIds.includes(id)
            ? { ...r, userNames: r.userIds.map((x) => this.truncateFullName(this.nameCache.get(x) || '')) }
            : r
        );
      });
    }
  }

  /**
   * Shorten first and last name separately to 12 chars each with ellipsis.
   * Uses first token as Vorname and last token as Nachname. If only one token, truncates that.
   */
  private truncateFullName(name: string): string {
    const cleaned = (name || '').toString().trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const parts = cleaned.split(' ');
    const trunc = (s: string) => (s.length > 12 ? s.slice(0, 12) + '…' : s);
    if (parts.length === 1) return trunc(parts[0]);
    const first = trunc(parts[0]);
    const last = trunc(parts[parts.length - 1]);
    // Avoid duplicating the same token if identical
    return first === last ? first : `${first} ${last}`;
  }

  /**
   * Add a new reaction or increment an existing one.
   * @param emoji The emoji key to add/increment.
   * Uses: reactions (local array), MAX_UNIQUE_REACTIONS, persistReactionDelta(...) for Firestore sync.
   */
  addOrIncrementReaction(emoji: string) {
    if (this.isDeleted) return;
    // From picker or quick-add: ensure current user reacts (idempotent)
    this.addReaction(emoji);
  }

  /**
   * Click handler for a reaction chip: decrements or removes when count hits zero.
   * @param emoji The emoji key to decrement/remove.
   */
  onClickReaction(emoji: string) {
    if (this.isDeleted) return;
    const r = this.reactions.find((x) => x.emoji === emoji);
    if (!r) {
      // If not present, treat as add
      this.addReaction(emoji);
      return;
    }
    if (r.currentUserReacted) this.removeReaction(emoji, r.isLegacyCount);
    else this.addReaction(emoji, r.isLegacyCount);
  }

  private async addReaction(emoji: string, legacy = false) {
    if (!this.currentUserId) return;
    const path = this.buildMessageDocPath();
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      if (legacy) {
        // replace numeric with map containing current user
        await updateDoc(ref, { [`reactions.${emoji}`]: { [this.currentUserId]: true } });
      } else {
        await updateDoc(ref, { [`reactions.${emoji}.${this.currentUserId}`]: true });
      }
    } catch (e) {}
  }

  private async removeReaction(emoji: string, legacy = false) {
    if (!this.currentUserId) return;
    const path = this.buildMessageDocPath();
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      if (legacy) {
        // cannot remove from numeric; convert to empty (delete field)
        await updateDoc(ref, { [`reactions.${emoji}`]: deleteField() });
      } else {
        await updateDoc(ref, { [`reactions.${emoji}.${this.currentUserId}`]: deleteField() });
      }
    } catch (e) {}
  }

  /**
   * Subset of reactions to display based on expansion state and width.
   */
  get visibleReactions() {
    const total = this.reactions.length;
    const limit = this.reactionsExpanded ? this.MAX_UNIQUE_REACTIONS : this.getCollapseThreshold();
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
      Math.min(this.reactions.length, this.MAX_UNIQUE_REACTIONS) - this.getCollapseThreshold()
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
    if (this.isVeryNarrow) return this.VERY_NARROW_COLLAPSE_THRESHOLD; // <= 400px → max 5
    return this.isNarrow ? this.NARROW_COLLAPSE_THRESHOLD : this.DEFAULT_COLLAPSE_THRESHOLD;
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

  /** True when this message is a soft-deleted placeholder text. */
  get isDeleted(): boolean {
    const t = (this.text || '').trim();
    return t === this.DELETED_PLACEHOLDER;
  }

  /** True when message has been edited (from input flag). */
  get isEdited(): boolean {
    return !!this.edited;
  }

  /**
   * Toggle the 3-dots context menu.
   * @param event Optional MouseEvent to stop propagation and prevent default.
   */
  toggleMoreMenu(event?: MouseEvent) {
    if (this.isDeleted) return;
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
    if (this.isDeleted) return;
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

    // Close reaction tooltip if open
    if (this.tooltipVisibleForEmoji) {
      this.tooltipVisibleForEmoji = null;
    }

    if (this.isMobile && this.showMiniActions) {
      const clickedInside = this.el.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.showMiniActions = false;
      }
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
    if (this.confirmDeleteOpen) {
      this.confirmDeleteOpen = false;
    }
  }

  /** Show mini actions when cursor enters the bubble. */
  onSpeechBubbleEnter() {
    if (this.isDeleted || this.isMobile) return;
    this.showMiniActions = true;
  }

  /** Hide only when pointer truly leaves component (not moving into mini-actions). */
  onSpeechBubbleLeave(event: MouseEvent) {
    if (this.isMobile) return;
    const next = event.relatedTarget as HTMLElement | null;
    const host = this.el.nativeElement.querySelector('.message-container') as HTMLElement | null;
    // Keep visible only if moving within THIS message's own container (incl. its mini-actions)
    if (next && host && host.contains(next)) return;
    this.showMiniActions = false;
    this.isMoreMenuOpen = false;
  }

  /** Keep mini actions visible while hovering over them. */
  onMiniActionsEnter() {
    if (this.isDeleted || this.isMobile) return;
    this.showMiniActions = true;
  }

  /** Hide when leaving mini actions AND not moving back to container. */
  onMiniActionsLeave(event: MouseEvent) {
    if (this.isMobile) return;
    const next = event.relatedTarget as HTMLElement | null;
    const host = this.el.nativeElement.querySelector('.message-container') as HTMLElement | null;
    // Keep visible only if moving within THIS message's own container (incl. its mini-actions)
    if (next && host && host.contains(next)) return;
    this.showMiniActions = false;
    this.isMoreMenuOpen = false;
  }

  onMessageClick() {
    if (this.isMobile && !this.isDeleted) {
      this.showMiniActions = !this.showMiniActions;
    }
  }

  // --- Long press handlers for reaction tooltips on mobile ---

  handleTouchStart(event: TouchEvent, emoji: string) {
    if (!this.isMobile) return;
    // Prevent click event from firing immediately
    event.stopPropagation();

    this.longPressTimer = setTimeout(() => {
      this.tooltipVisibleForEmoji = emoji;
      // Prevent the click event from firing after the long press
      event.preventDefault();
    }, 400); // 400ms for long press
  }

  handleTouchEnd(event: TouchEvent) {
    if (!this.isMobile) return;
    clearTimeout(this.longPressTimer);
  }

  handleTouchMove(event: TouchEvent) {
    if (!this.isMobile) return;
    // If finger moves, cancel the long press
    clearTimeout(this.longPressTimer);
  }

  /**
   * Enter editing mode: show textarea and preload editText with current text.
   */
  startEdit() {
    if (this.isDeleted) return;
    this.isEditing = true;
    this.showMiniActions = false; // hide actions during edit mode
    this.editText = this.text || '';
    // Defer to next tick so textarea is in the DOM
    setTimeout(() => this.autosizeEditTextarea());
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
    const path = this.buildMessageDocPath();
    if (!path) {
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
      const ref = doc(this.firestore, path);
      await updateDoc(ref, { text: newText, edited: true });
      this.text = newText;
      this.edited = true;
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
  openConfirmDelete() {
    if (this.isDeleted) return;
    this.isMoreMenuOpen = false;
    this.confirmDeleteOpen = true;
  }

  cancelConfirmDelete() {
    this.confirmDeleteOpen = false;
  }

  async confirmDelete() {
    const path = this.buildMessageDocPath();
    if (!path) return;
    try {
      this.isDeleting = true;
      const ref = doc(this.firestore, path);
      // Soft delete: keep the message document, replace content and mark deleted
      await updateDoc(ref, { text: this.DELETED_PLACEHOLDER, deleted: true });
      this.text = this.DELETED_PLACEHOLDER;
      this.isMoreMenuOpen = false;
      this.confirmDeleteOpen = false;
    } catch (e) {
      // noop
    } finally {
      this.isDeleting = false;
    }
  }

  /** Quick-add a reaction via the mini actions bar and close the bar. */
  onQuickReact(emoji: string) {
    if (this.isDeleted) return;
    this.addOrIncrementReaction(emoji);
    this.showMiniActions = false;
  }

  /**
   * Show the reactions emoji picker from the mini actions bar.
   * @param event MouseEvent – stopped to avoid closing from document click.
   * Uses setTimeout to open after mini actions hide state is applied.
   */
  onMiniAddReactionClick(event: MouseEvent) {
    if (this.isDeleted) return;
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
    if (this.isDeleted) return;
    event.stopPropagation();
    this.showMiniActions = false;
    if (!this.chatId || !this.messageId) return;
    this.viewStateService.requestCloseDevspaceDrawer();
    this.viewStateService.currentView = 'thread';
    this.threadPanel.openThread({
      chatId: this.chatId,
      messageId: this.messageId,
      collectionName: this.collectionName,
    });
  }

  /** Open the user card dialog for the message author when clicking on the user name. */
  async onUserNameClick(event?: MouseEvent) {
    event?.stopPropagation();
    if (!this.authorId) return;
    const user = await firstValueFrom(this.userService.userById$(this.authorId));
    if (!user) return;
    this.dialog.open(DialogUserCardComponent, {
      data: { user },
      panelClass: 'user-card-dialog',
      width: '90vw',
      maxWidth: '500px',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: true,
    });
  }

  /**
   * Persist reaction change to Firestore using atomic updates.
   * @param emoji Emoji key in the map (stored as reactions.<emoji> field path).
   * @param delta +1 to increment, -1 to decrement.
   * @param newCount New local count after applying delta (<=0 removes the field).
   */
  // persistReactionDelta no longer used (count model replaced with user map)

  /**
   * Close pickers only when pointer leaves a padded area around the host (message-container).
   * Adds ~12px tolerance, and keeps open when hovering the emoji picker itself.
   */
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent) {
    if (!this.showEmojiPicker && !this.editEmojiPickerVisible) return;
    const hostEl = (event.currentTarget && (this as any).el?.nativeElement) as HTMLElement | undefined;
    // Fallback to global document-based query: use the first .message-container inside this component.
    const root = (this as any).el?.nativeElement as HTMLElement | undefined;
    const host = root ?? undefined;
    const container = host?.querySelector('.message-container') as HTMLElement | null;
    const refEl = container ?? host;
    if (!refEl) return;

    const rect = refEl.getBoundingClientRect();
    const pad = 12;
    const x = event.clientX;
    const y = event.clientY;
    const insidePadded =
      x >= rect.left - pad &&
      x <= rect.right + pad &&
      y >= rect.top - pad &&
      y <= rect.bottom + pad;

    const target = event.target as HTMLElement | null;
    const overPicker = !!target?.closest('.emoji-picker-container');
    if (!insidePadded && !overPicker) {
      this.onClosePicker();
      this.closeEditEmojiPicker();
    }
  }
  
  private async getAnswersInfo() {
    if (!this.chatId || !this.messageId) return;

    const coll = collection(
      this.firestore,
      `${this.collectionName}/${this.chatId}/messages/${this.messageId}/thread`
    );
    this.getAnswersAmount(coll);
    this.getLastAnswerTime(coll);
  }

  private async getAnswersAmount(coll: any) {
    this.answersCountSub = collectionData(coll)
      .pipe(map((docs) => docs.length))
      .subscribe((count) => {
        this.answersCount = count;
      });
  }

  private async getLastAnswerTime(coll: any) {
    this.lastTimeSub = collectionData(coll)
      .pipe(
        map((messages) => {
          if (messages.length === 0) return '';
          const timestamps = messages.map((msg: any) => msg.timestamp?.toMillis()).filter((ts: any): ts is number => typeof ts === 'number');
          if (timestamps.length === 0) return '';
          const latest = Math.max(...timestamps);
          const latestDate = new Date(latest);
          return latestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })
      )
      .subscribe((timestamp) => {
        this.lastTime = timestamp;
      });
  }

  /**
   * DI constructor.
   * @param firestore AngularFire Firestore instance used for message updates/deletes and reactions.
   * @param threadPanel Service to open the thread side panel for a given message.
   */
  constructor(
    
    private firestore: Firestore,
   
    private threadPanel: ThreadPanelService,
   
    private userService: UserService,
    public el: ElementRef<HTMLElement>,
    public viewStateService: ViewStateService
  ,
    private dialog: MatDialog
  ) {}
}
