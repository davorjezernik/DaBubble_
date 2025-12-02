import {
  Component,
  HostListener,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThreadPanelService } from '../../../../services/thread-panel.service';
import { Firestore, collection, collectionData, getCountFromServer, query, orderBy, limit } from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';
import { MessageLogicService } from './message-logic.service';
import { MessageReactionService } from './message-reaction.service';
import { MessageInteractionService } from './message-interaction.service';
import { ViewStateService } from '../../../../services/view-state.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';
import { MessageEditModeComponent } from './message-edit-mode/message-edit-mode.component';
import { MessageMiniActionsComponent } from './message-mini-actions/message-mini-actions.component';
import { MessageReactionsComponent } from './message-reactions/message-reactions.component';
import { CloseOnOutsideClickDirective } from './directives/close-on-outside-click.directive';
import { CloseOnEscapeDirective } from './directives/close-on-escape.directive';
import { firstValueFrom, map, Subscription } from 'rxjs';
import {
  DELETED_PLACEHOLDER,
  MAX_UNIQUE_REACTIONS,
  isNarrowViewport,
  isVeryNarrowViewport,
  isMobileViewport,
  normalizeTimestamp,
} from './message-bubble.utils';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [
    CommonModule,
    MessageEditModeComponent,
    MessageMiniActionsComponent,
    MessageReactionsComponent,
    CloseOnOutsideClickDirective,
    CloseOnEscapeDirective,
  ],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss',
  providers: [MessageReactionService, MessageInteractionService],
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
  isNarrow = typeof window !== 'undefined' ? isNarrowViewport(window.innerWidth) : false;
  isVeryNarrow = typeof window !== 'undefined' ? isVeryNarrowViewport(window.innerWidth) : false;
  isMobile = typeof window !== 'undefined' ? isMobileViewport(window.innerWidth) : false;

  currentUserId: string | null = null;
  readonly DELETED_PLACEHOLDER = DELETED_PLACEHOLDER;
  readonly MAX_UNIQUE_REACTIONS = MAX_UNIQUE_REACTIONS;
  lastTimeSub?: Subscription;
  answersCountSub?: Subscription;
  private reactionStateSub = new Subscription();
  private subscriptions = new Subscription(); // Centralized subscription management

  constructor(
    private firestore: Firestore,
    private threadPanel: ThreadPanelService,
    private userService: UserService,
    public el: ElementRef<HTMLElement>,
    public viewStateService: ViewStateService,
    private dialog: MatDialog,
    private messageLogic: MessageLogicService,
    public reactionService: MessageReactionService,
    private interactionService: MessageInteractionService
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

  /** Update viewport flags when window is resized. */
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
    
    this.subscriptions.add(
      this.userService.currentUser$().subscribe((u: any) => {
        this.currentUserId = u?.uid ?? null;
        this.rebuildReactions();
      })
    );
    
    this.reactionStateSub.add(
      this.reactionService.reactions$.subscribe((reactions) => (this.reactions = reactions))
    );
    this.reactionStateSub.add(
      this.reactionService.showEmojiPicker$.subscribe((show) => (this.showEmojiPicker = show))
    );
  }

  /** Handle input changes, rebuild reactions and update thread info. */
  ngOnChanges(changes: SimpleChanges) {
    if ('reactionsMap' in changes) {
      this.rebuildReactions();
    }
    if (changes['messageId'] || changes['chatId'] || changes['collectionName']) {
      this.getAnswersInfo();
    }
  }

  /** Cleanup subscriptions on component destruction. */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.answersCountSub?.unsubscribe();
    this.lastTimeSub?.unsubscribe();
    this.reactionStateSub.unsubscribe();
  }

  /** Rebuild reactions array from reactionsMap input. */
  private rebuildReactions() {
    this.reactionService.rebuildReactions(this.reactionsMap || {}, this.currentUserId);
  }

  /** Shorten first and last name separately to 12 chars each with ellipsis. */
  private truncateFullName(name: string): string {
    return this.messageLogic.truncateFullName(name);
  }

  /** Normalize last reply timestamp to a Date. */
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

  /**  Closes the menu and prepares editText buffer from current text. */
  onEditMessage() {
    if (this.isDeleted) return;
    this.isMoreMenuOpen = false;
    this.startEdit();
  }

  /** Close more menu when clicking outside (called by directive).*/
  onCloseMoreMenu() {
    this.isMoreMenuOpen = false;
  }

  /** Close mini actions when clicking outside on mobile (called by directive).*/
  onCloseMiniActions() {
    this.showMiniActions = false;
  }

  /**Close menus and pickers when ESC key is pressed (called by directive).*/
  onEscapePressed() {
    this.isMoreMenuOpen = false;
    this.reactionService.closeEmojiPicker();
  }

  /** Show mini actions when cursor enters the bubble. */
  onSpeechBubbleEnter() {
    if (this.isDeleted || this.isMobile) return;
    this.showMiniActions = true;
  }

  /** Hide mini actions when pointer truly leaves component (not moving into mini-actions). */
  onSpeechBubbleLeave(event: MouseEvent) {
    if (this.isMobile) return;
    const host = this.el.nativeElement.querySelector('.message-container') as HTMLElement | null;
    if (!host) return;
    if (this.interactionService.isMovingToChild(event, host)) return;
    this.showMiniActions = false;
    this.isMoreMenuOpen = false;
  }

  /** Update mini actions visibility state from child component. */
  onMiniActionsVisibilityChange(visible: boolean) {
    this.showMiniActions = visible;
  }

  /** Close more menu when requested by mini actions component. */
  onMiniActionsCloseMenu() {
    this.isMoreMenuOpen = false;
  }

  /** Handle thread opening from mini actions component. */
  onOpenThread(request: { chatId: string; messageId: string; collectionName: 'channels' | 'dms' }) {
    this.viewStateService.requestCloseDevspaceDrawer();
    this.viewStateService.currentView = 'thread';
    this.threadPanel.openThread(request);
  }

  /** Toggle mini actions on mobile tap. */
  onMessageClick() {
    if (this.isMobile && !this.isDeleted) {
      this.showMiniActions = !this.showMiniActions;
    }
  }

  /** Enter editing mode: show edit component.*/
  startEdit() {
    if (this.isDeleted) return;
    this.isEditing = true;
    this.showMiniActions = false;
  }

  /** Cancel edit mode without saving changes. */
  cancelEdit() {
    this.isEditing = false;
  }

  /** Save the edited message text to Firestore.*/
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

  /** Delete this message from Firestore (doc/deleteDoc) after user confirmation.*/
  openConfirmDelete() {
    if (this.isDeleted) return;
    this.isMoreMenuOpen = false;
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      panelClass: 'delete-confirm-dialog',
      disableClose: true,
      autoFocus: false,
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.confirmDelete();
    });
  }

  /** Execute soft delete after user confirmation. */
  async confirmDelete() {
    const path = this.getMessagePath();
    if (!path) return;
    try {
      this.isDeleting = true;
      await this.messageLogic.softDeleteMessage(path, this.DELETED_PLACEHOLDER);
      this.text = this.DELETED_PLACEHOLDER;
      this.isMoreMenuOpen = false;
      this.reactions = [];
    } catch (e) {
    } finally {
      this.isDeleting = false;
    }
  }

  /** Quick-add a reaction via the mini actions bar and close the bar. */
  onQuickReact(emoji: string) {
    if (this.isDeleted || !this.currentUserId) return;
    const path = this.getMessagePath();
    void this.reactionService.addOrIncrementReaction(path, emoji, this.currentUserId);
  }

  /** Show the reactions emoji picker from the mini actions bar.*/
  onMiniAddReactionClick() {
    this.reactionService.toggleEmojiPicker();
  }

  /** Handle reaction chip click to toggle user's reaction. */
  onReactionClick(emoji: string) {
    if (this.isDeleted) return;
    if (!this.currentUserId) return;
    const path = this.getMessagePath();
    void this.reactionService.handleReactionClick(path, emoji, this.currentUserId);
  }

  /** Handle emoji selection from reactions component picker. */
  onReactionsEmojiSelected(emoji: string) {
    this.onEmojiSelected(emoji);
  }

  /** Toggle emoji picker from reactions component. */
  onReactionsToggleEmojiPicker() {
    this.reactionService.toggleEmojiPicker();
  }

  /** Close emoji picker from reactions component. */
  onReactionsCloseEmojiPicker() {
    this.reactionService.closeEmojiPicker();
  }

  /**
   * Open the side thread panel for this message.
   * @param event MouseEvent – stopped to prevent bubbling to container.
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

    const container = this.el.nativeElement.querySelector(
      '.message-container'
    ) as HTMLElement | null;
    const refEl = container ?? this.el.nativeElement;
    const insidePadded = this.interactionService.isMouseWithinPaddedArea(
      refEl,
      event.clientX,
      event.clientY
    );
    const overPicker = this.interactionService.isElementOrAncestor(
      event.target as HTMLElement,
      '.emoji-picker-container'
    );

    if (!insidePadded && !overPicker) {
      this.reactionService.closeEmojiPicker();
    }
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

  /** Subscribe to thread messages count using efficient aggregation. */
  private async getAnswersAmount(coll: any) {
    this.answersCountSub?.unsubscribe();
    
    // Use getCountFromServer for efficient count without fetching all documents
    const q = query(coll);
    try {
      const snapshot = await getCountFromServer(q);
      this.answersCount = snapshot.data().count;
    } catch (error) {
      console.error('Error getting answers count:', error);
      this.answersCount = 0;
    }
  }

  /** Subscribe to latest thread answer timestamp. */
  private async getLastAnswerTime(coll: any) {
    this.lastTimeSub?.unsubscribe();
    
    // Only fetch the single most recent message instead of all messages
    const q = query(coll, orderBy('timestamp', 'desc'), limit(1));
    
    this.lastTimeSub = collectionData(q)
      .pipe(
        map((messages) => {
          if (messages.length === 0) return '';
          const msg: any = messages[0];
          const ts = msg.timestamp?.toMillis();
          if (typeof ts !== 'number') return '';
          const latestDate = new Date(ts);
          return latestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })
      )
      .subscribe((timestamp) => {
        this.lastTime = timestamp;
      });
  }
}
