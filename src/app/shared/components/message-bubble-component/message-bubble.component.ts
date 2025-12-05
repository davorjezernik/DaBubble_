import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThreadPanelService } from '../../../../services/thread-panel.service';
import { UserService } from '../../../../services/user.service';
import { MessageLogicService, MessageReaction } from './message-logic.service';
import { MessageReactionService } from './message-reaction.service';
import { MessageInteractionService } from './message-interaction.service';
import { ViewStateService } from '../../../../services/view-state.service';
import { MatDialog } from '@angular/material/dialog';
import { MessageEditModeComponent } from './message-edit-mode/message-edit-mode.component';
import { MessageMiniActionsComponent } from './message-mini-actions/message-mini-actions.component';
import { MessageReactionsComponent } from './message-reactions/message-reactions.component';
import { CloseOnOutsideClickDirective } from './directives/close-on-outside-click.directive';
import { CloseOnEscapeDirective } from './directives/close-on-escape.directive';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  DELETED_PLACEHOLDER,
  isNarrowViewport,
  isVeryNarrowViewport,
  isMobileViewport,
} from './message-bubble.utils';
import { MessageThreadSummaryComponent } from './message-thread-summary/message-thread-summary.component.ts/message-thread-summary.component.ts';
import { EmojiPickerCloseOnOutsideHoverDirective } from './directives/emoji-picker-close-on-outside-hover.directive';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [
    CommonModule,
    MessageEditModeComponent,
    MessageMiniActionsComponent,
    MessageReactionsComponent,
    MessageThreadSummaryComponent,
    CloseOnOutsideClickDirective,
    CloseOnEscapeDirective,
    EmojiPickerCloseOnOutsideHoverDirective
  ],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss',
  providers: [MessageReactionService, MessageInteractionService],
})

export class MessageBubbleComponent implements OnInit, OnChanges, OnDestroy {
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
  @Input() isThreadView: boolean = false;
  @Input() edited?: boolean;
  @Input() authorId?: string;

  showEmojiPicker = false;
  isMoreMenuOpen = false;
  showMiniActions = false;
  isEditing = false;
  isSaving = false;
  isDeleting = false;
  reactions: MessageReaction[] = [];
  
  isNarrow = false;
  isVeryNarrow = false;
  isMobile = false;
  currentUserId: string | null = null;
  currentUserRecentEmojis: string[] = [];
  
  readonly DELETED_PLACEHOLDER = DELETED_PLACEHOLDER;
  
  private subscriptions = new Subscription();

  constructor(
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
   * Handle a selected emoji from the main emoji picker.
   * @param emoji The unicode emoji string to add or increment.
   * Side effects: updates reactions in Firestore via logic service.
   */
  async onEmojiSelected(emoji: string) {
    if (this.isDeleted || !this.currentUserId) return;
    const path = this.getMessagePath();
    if (!path) return;
    await this.messageLogic.addReaction(path, emoji, this.currentUserId);
    this.reactionService.closeEmojiPicker();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateViewportFlags();
  }

  private updateViewportFlags(): void {
    if (typeof window === 'undefined') return;
    this.isNarrow = isNarrowViewport(window.innerWidth);
    this.isVeryNarrow = isVeryNarrowViewport(window.innerWidth);
    this.isMobile = isMobileViewport(window.innerWidth);
  }

  ngOnInit(): void {
    this.updateViewportFlags();
    this.messageLogic.onNamesUpdated = () => this.rebuildReactions();
    
    this.subscriptions.add(
      this.userService.currentUser$().subscribe((u: any) => {
        this.currentUserId = u?.uid ?? null;
        this.currentUserRecentEmojis = u?.recentEmojis ?? [];
        this.rebuildReactions();
      })
    );
    this.subscriptions.add(
      this.reactionService.reactions$.subscribe((reactions) => (this.reactions = reactions))
    );
    this.subscriptions.add(
      this.reactionService.showEmojiPicker$.subscribe((show) => (this.showEmojiPicker = show))
    );
    this.subscriptions.add(
      this.reactionService.isMoreMenuOpen$.subscribe((open) => (this.isMoreMenuOpen = open))
    );
    this.subscriptions.add(
      this.reactionService.showMiniActions$.subscribe((show) => (this.showMiniActions = show))
    );
  }

  /**
   * Handle input changes, rebuild reactions and update thread info.
   * @param changes Angular SimpleChanges for this component.
   */
  ngOnChanges(changes: SimpleChanges) {
    if ('reactionsMap' in changes) {
      this.rebuildReactions();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Rebuild reactions array from reactionsMap input. */
  private rebuildReactions() {
    this.reactionService.rebuildReactions(this.reactionsMap || {}, this.currentUserId);
  }

  /** Shorten first and last name separately to 12 chars each with ellipsis. */
  private truncateFullName(name: string): string {
    return this.messageLogic.truncateFullName(name);
  }

  get isDeleted(): boolean {
    return this.messageLogic.isMessageDeleted(this.text, this.DELETED_PLACEHOLDER);
  }

  /** True when message has been edited (from input flag). */
  get isEdited(): boolean {
    return !!this.edited;
  }

  toggleMoreMenu(event?: MouseEvent) {
    if (this.isDeleted) return;
    event?.stopPropagation();
    event?.preventDefault();
    this.reactionService.toggleMoreMenu();
  }

  onEditMessage() {
    if (this.isDeleted) return;
    this.reactionService.closeMoreMenu();
    this.startEdit();
  }

  onCloseMoreMenu() {
    this.reactionService.closeMoreMenu();
  }

  onCloseMiniActions() {
    this.reactionService.setMiniActionsVisible(false);
  }

  onEscapePressed() {
    this.reactionService.closeAll();
  }

  onSpeechBubbleEnter() {
    if (this.isDeleted || this.isMobile) return;
    this.reactionService.setMiniActionsVisible(true);
  }

  onSpeechBubbleLeave(event: MouseEvent) {
    if (this.isMobile) return;
    const host = this.el.nativeElement.querySelector('.message-container') as HTMLElement | null;
    if (!host || this.interactionService.isMovingToChild(event, host)) return;
    this.reactionService.setMiniActionsVisible(false);
    this.reactionService.closeMoreMenu();
  }

  onMiniActionsVisibilityChange(visible: boolean) {
    this.reactionService.setMiniActionsVisible(visible);
  }

  onMiniActionsCloseMenu() {
    this.reactionService.closeMoreMenu();
  }

  /** Handle thread opening from mini actions component. */
  onOpenThread(request: { chatId: string; messageId: string; collectionName: 'channels' | 'dms' }) {
    this.viewStateService.requestCloseDevspaceDrawer();
    this.viewStateService.currentView = 'thread';
    this.threadPanel.openThread(request);
  }

  onMessageClick() {
    if (this.isMobile && !this.isDeleted) {
      this.reactionService.setMiniActionsVisible(!this.showMiniActions);
    }
  }

  startEdit() {
    if (this.isDeleted) return;
    this.isEditing = true;
    this.reactionService.setMiniActionsVisible(false);
  }

  /** Cancel edit mode without saving changes. */
  cancelEdit() {
    this.isEditing = false;
  }

  /** Save the edited message text to Firestore.*/
  async saveEdit(newText: string) {
    const path = this.getMessagePath();
    if (!path) return this.setEditingState(false);
    try {
      await this.saveEditedMessage(path, newText);
    } catch (e) {
      console.error('Error saving message:', e);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Persist edited text to Firestore using the logic service
   * and update local message state.
   */
  private async saveEditedMessage(path: string, newText: string) {
    this.isSaving = true;
    await this.messageLogic.saveEditedText(path, newText);
    this.text = newText;
    this.edited = true;
    this.setEditingState(false);
  }

  /** Update the local editing state flag. */
  private setEditingState(isEditing: boolean) {
    this.isEditing = isEditing;
  }

  async openConfirmDelete() {
    if (this.isDeleted) return;
    this.reactionService.closeMoreMenu();
    const { ConfirmDeleteDialogComponent } = await import('./confirm-delete-dialog.component');
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      panelClass: 'delete-confirm-dialog',
      disableClose: true,
      autoFocus: false,
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.confirmDelete();
    });
  }

  async confirmDelete() {
    const path = this.getMessagePath();
    if (!path) return;
    this.isDeleting = true;
    try {
      await this.messageLogic.softDeleteMessage(path, this.DELETED_PLACEHOLDER);
      this.text = this.DELETED_PLACEHOLDER;
      this.reactions = [];
    } catch (e) {
      console.error('Error deleting message:', e);
    } finally {
      this.isDeleting = false;
    }
  }

  /** Quick-add a reaction via the mini actions bar and close the bar. */
  async onQuickReact(emoji: string) {
    if (this.isDeleted || !this.currentUserId) return;
    const path = this.getMessagePath();
    if (!path) return;
    await this.messageLogic.addReaction(path, emoji, this.currentUserId);
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
  async onReactionsEmojiSelected(emoji: string) {
    if (this.isDeleted || !this.currentUserId) return;
    const path = this.getMessagePath();
    if (!path) return;
    await this.messageLogic.addReaction(path, emoji, this.currentUserId);
    this.reactionService.closeEmojiPicker();
  }

  /** Toggle emoji picker from reactions component. */
  onReactionsToggleEmojiPicker() {
    this.reactionService.toggleEmojiPicker();
  }

  /** Close emoji picker from reactions component. */
  onReactionsCloseEmojiPicker() {
    this.reactionService.closeEmojiPicker();
  }

  onCommentClick(event?: MouseEvent) {
    if (this.isDeleted || !this.chatId || !this.messageId) return;
    event?.stopPropagation();
    this.reactionService.setMiniActionsVisible(false);
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
    const { DialogUserCardComponent } = await import('../dialog-user-card/dialog-user-card.component');
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
}
