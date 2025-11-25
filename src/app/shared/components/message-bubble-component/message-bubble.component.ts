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
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';
import { MessageLogicService } from './message-logic.service';
import { MessageReactionService } from './message-reaction.service';
import { ViewStateService } from '../../../../services/view-state.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';
import { MessageEditModeComponent } from './message-edit-mode/message-edit-mode.component';
import { firstValueFrom, map, Subscription } from 'rxjs';
import {
  DELETED_PLACEHOLDER,
  MAX_UNIQUE_REACTIONS,
  DEFAULT_COLLAPSE_THRESHOLD,
  NARROW_COLLAPSE_THRESHOLD,
  VERY_NARROW_COLLAPSE_THRESHOLD,
  isNarrowViewport,
  isVeryNarrowViewport,
  isMobileViewport,
  normalizeTimestamp,
} from './message-bubble.utils';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent, MessageEditModeComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss',
  providers: [MessageReactionService]
})
export class MessageBubbleComponent implements OnChanges, OnDestroy {
  @Input() incoming: boolean = false;
  @Input() name: string = 'Frederik Beck';
  @Input() time: string = '15:06 Uhr';
  @Input() avatar: string = 'assets/img-profile/frederik-beck.png';
  @Input() text: string =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.';
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() parentMessageId?: string;
  @Input() reactionsMap?: Record<string, number | Record<string, true>> | null;
  @Input() collectionName: 'channels' | 'dms' = 'dms';
  @Input() lastReplyAt?: unknown;
  @Input() context: 'chat' | 'thread' = 'chat';
  @Input() isThreadView: boolean = false;
  @Input() edited?: boolean;
  @Input() authorId?: string;
  @Output() editMessage = new EventEmitter<void>();

  showEmojiPicker = false;
  reactionsExpanded = false;
  isMoreMenuOpen = false;
  showMiniActions = false;
  isEditing = false;
  isSaving = false;
  isDeleting = false;
  lastTime: string = '';
  answersCount: number = 0;
  reactions: Array<{
    emoji: string;
    count: number;
    userIds: string[];
    userNames: string[];
    currentUserReacted: boolean;
    isLegacyCount: boolean;
  }> = [];
  tooltipVisibleForEmoji: string | null = null;
  isNarrow = typeof window !== 'undefined' ? isNarrowViewport(window.innerWidth) : false;
  isVeryNarrow = typeof window !== 'undefined' ? isVeryNarrowViewport(window.innerWidth) : false;
  isMobile = typeof window !== 'undefined' ? isMobileViewport(window.innerWidth) : false;

  private currentUserId: string | null = null;
  readonly DELETED_PLACEHOLDER = DELETED_PLACEHOLDER;
  readonly MAX_UNIQUE_REACTIONS = MAX_UNIQUE_REACTIONS;
  private readonly DEFAULT_COLLAPSE_THRESHOLD = DEFAULT_COLLAPSE_THRESHOLD;
  private readonly NARROW_COLLAPSE_THRESHOLD = NARROW_COLLAPSE_THRESHOLD;
  private readonly VERY_NARROW_COLLAPSE_THRESHOLD = VERY_NARROW_COLLAPSE_THRESHOLD;
  lastTimeSub?: Subscription;
  answersCountSub?: Subscription;
  private reactionStateSub = new Subscription();

  constructor(
    private firestore: Firestore,
    private threadPanel: ThreadPanelService,
    private userService: UserService,
    public el: ElementRef<HTMLElement>,
    public viewStateService: ViewStateService,
    private dialog: MatDialog,
    private messageLogic: MessageLogicService,
    public reactionService: MessageReactionService
  ) {}

  /** Build Firestore path via logic service */
  private getMessagePath(): string | null {
    return this.messageLogic.buildMessageDocPath(
      this.collectionName,
      this.chatId,
      this.messageId,
      this.isThreadView,
      this.parentMessageId
    );
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
    if (!this.currentUserId) return;
    const path = this.getMessagePath();
    void this.reactionService.addOrIncrementReaction(path, emoji, this.currentUserId);
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (typeof window !== 'undefined') {
      this.isNarrow = isNarrowViewport(window.innerWidth);
      this.isVeryNarrow = isVeryNarrowViewport(window.innerWidth);
      this.isMobile = isMobileViewport(window.innerWidth);
    }
  }

  /**
   * React to input changes from parent.
   * Currently maps reactionsMap (Record<emoji, count>) into reactions array for rendering.
   * @param changes Angular SimpleChanges for this component.
   */

  ngOnInit(): void {
    this.messageLogic.onNamesUpdated = () => this.rebuildReactions();
    this.userService.currentUser$().subscribe((u: any) => {
      this.currentUserId = u?.uid ?? null;
      this.rebuildReactions();
    });
    this.reactionStateSub.add(
      this.reactionService.reactions$.subscribe((reactions) => (this.reactions = reactions))
    );
    this.reactionStateSub.add(
      this.reactionService.showEmojiPicker$.subscribe((show) => (this.showEmojiPicker = show))
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('reactionsMap' in changes) {
      this.rebuildReactions();
    }
    this.getAnswersInfo();
  }

  ngOnDestroy(): void {
    this.answersCountSub?.unsubscribe();
    this.reactionStateSub.unsubscribe();
  }

  private rebuildReactions() {
    this.reactionService.rebuildReactions(this.reactionsMap || {}, this.currentUserId);
  }

  /**
   * Shorten first and last name separately to 12 chars each with ellipsis.
   * Uses first token as Vorname and last token as Nachname. If only one token, truncates that.
   */
  private truncateFullName(name: string): string {
    return this.messageLogic.truncateFullName(name);
  }

  /**
   * Add a new reaction or increment an existing one.
   * @param emoji The emoji key to add/increment.
   * Uses: reactions (local array), MAX_UNIQUE_REACTIONS.
   */
  // Reaction add/remove now delegated to MessageLogicService

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
    return normalizeTimestamp(this.lastReplyAt);
  }

  /** True when this message is a soft-deleted placeholder text. */
  get isDeleted(): boolean {
    const t = (this.text || '').trim();
    return t === DELETED_PLACEHOLDER;
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
    if (this.tooltipVisibleForEmoji) {
      this.tooltipVisibleForEmoji = null;
    }
    if (this.isMobile && this.showMiniActions) {
      const clickedInside = this.el.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.showMiniActions = false;
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
      this.reactionService.closeEmojiPicker();
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
    if (next && host && host.contains(next)) return;
    this.showMiniActions = false;
    this.isMoreMenuOpen = false;
  }

  onMessageClick() {
    if (this.isMobile && !this.isDeleted) {
      this.showMiniActions = !this.showMiniActions;
    }
  }

  /**
   * Enter editing mode: show edit component.
   */
  startEdit() {
    if (this.isDeleted) return;
    this.isEditing = true;
    this.showMiniActions = false;
  }

  /** Exit editing mode without saving. */
  cancelEdit() {
    this.isEditing = false;
  }

  /**
   * Save the edited message text to Firestore.
   * Called when edit component emits save event.
   */
  async saveEdit(newText: string) {
    const path = this.getMessagePath();
    if (!path) { 
      this.isEditing = false; 
      return; 
    }
    try {
      this.isSaving = true;
      await this.messageLogic.saveEditedText(path, newText);
      this.text = newText;
      this.edited = true;
      this.isEditing = false;
    } catch (e) { 
      console.error('Error saving message:', e);
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
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      panelClass: 'delete-confirm-dialog',
      disableClose: true,
      autoFocus: false
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) this.confirmDelete();
    });
  }

  async confirmDelete() {
    const path = this.getMessagePath();
    if (!path) return;
    try {
      this.isDeleting = true;
      await this.messageLogic.softDeleteMessage(path, this.DELETED_PLACEHOLDER);
      this.text = this.DELETED_PLACEHOLDER;
      this.isMoreMenuOpen = false;
      this.reactions = [];
      this.reactionsExpanded = false;
    } catch (e) { } finally { this.isDeleting = false; }
  }

  /** Quick-add a reaction via the mini actions bar and close the bar. */
  onQuickReact(emoji: string) {
    if (this.isDeleted) return;
    if (!this.currentUserId) return;
    const path = this.getMessagePath();
    void this.reactionService.addOrIncrementReaction(path, emoji, this.currentUserId);
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
    this.reactionService.toggleEmojiPicker();
  }

  onReactionChipClick(emoji: string) {
    if (this.isDeleted) return;
    if (!this.currentUserId) return;
    const path = this.getMessagePath();
    void this.reactionService.handleReactionClick(path, emoji, this.currentUserId);
  }

  onReactionChipEnter(emoji: string) {
    if (this.isMobile) return;
    this.tooltipVisibleForEmoji = emoji;
  }

  onReactionChipLeave() {
    if (this.isMobile) return;
    this.tooltipVisibleForEmoji = null;
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
   * Close pickers only when pointer leaves a padded area around the host (message-container).
   * Adds ~12px tolerance, and keeps open when hovering the emoji picker itself.
   */
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent) {
    if (!this.showEmojiPicker) return;
    const host = (this.el?.nativeElement as HTMLElement | undefined) ?? undefined;
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
      this.reactionService.closeEmojiPicker();
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
}
