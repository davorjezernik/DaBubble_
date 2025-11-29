import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, deleteField } from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';
import { MessageLogicService, MessageReaction } from './message-logic.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MessageReactionService {

  private _reactions = new BehaviorSubject<MessageReaction[]>([]);
  public reactions$ = this._reactions.asObservable();

  private _showEmojiPicker = new BehaviorSubject<boolean>(false);
  public showEmojiPicker$ = this._showEmojiPicker.asObservable();

  private _editEmojiPickerVisible = new BehaviorSubject<boolean>(false);
  public editEmojiPickerVisible$ = this._editEmojiPickerVisible.asObservable();
  
  constructor(
    private firestore: Firestore,
    private userService: UserService,
    private messageLogic: MessageLogicService
  ) { }

  /**
   * Rebuild reactions array from Firestore reactionsMap.
   * @param reactionsMap The raw reactions data from Firestore (emoji -> count or userIds).
   * @param currentUserId The current user's ID to determine if they reacted.
   * Side effects: updates reactions$ observable.
   */
  rebuildReactions(reactionsMap: Record<string, number | Record<string, true>> | null | undefined, currentUserId: string | null) {
    const reactions = this.messageLogic.rebuildReactions(reactionsMap, currentUserId);
    this._reactions.next(reactions);
  }

  /**
   * Toggle the reactions emoji picker visibility.
   * Side effects: updates showEmojiPicker$ observable.
   */
  toggleEmojiPicker() {
    this._showEmojiPicker.next(!this._showEmojiPicker.value);
  }

  /**
   * Open the reactions emoji picker.
   * Side effects: updates showEmojiPicker$ to true.
   */
  openEmojiPicker() {
    this._showEmojiPicker.next(true);
  }

  /**
   * Close the reactions emoji picker.
   * Side effects: updates showEmojiPicker$ to false.
   */
  closeEmojiPicker() {
    this._showEmojiPicker.next(false);
  }

  /**
   * Toggle the edit mode emoji picker visibility.
   * Side effects: updates editEmojiPickerVisible$ observable.
   */
  toggleEditEmojiPicker() {
    this._editEmojiPickerVisible.next(!this._editEmojiPickerVisible.value);
  }

  /**
   * Close the edit mode emoji picker.
   * Side effects: updates editEmojiPickerVisible$ to false.
   */
  closeEditEmojiPicker() {
    this._editEmojiPickerVisible.next(false);
  }

  /**
   * Add or increment a reaction from the emoji picker.
   * @param path The Firestore document path for the message.
   * @param emoji The unicode emoji string to add.
   * @param currentUserId The current user's ID.
   * Side effects: updates Firestore, closes emoji picker.
   */
  async addOrIncrementReaction(path: string | null, emoji: string, currentUserId: string) {
    if (!path) return;
    await this.messageLogic.addReaction(path, emoji, currentUserId);
    this.closeEmojiPicker();
  }

  /**
   * Handle clicking on a reaction chip to toggle the user's reaction.
   * @param path The Firestore document path for the message.
   * @param emoji The unicode emoji string being toggled.
   * @param currentUserId The current user's ID.
   * Side effects: adds reaction if not reacted, removes if already reacted.
   */
  async handleReactionClick(path: string | null, emoji: string, currentUserId: string) {
    if (!path) return;
    
    const currentReactions = this._reactions.getValue();
    const reaction = currentReactions.find(r => r.emoji === emoji);

    if (!reaction) {
      await this.messageLogic.addReaction(path, emoji, currentUserId);
      return;
    }

    if (reaction.currentUserReacted) {
      await this.messageLogic.removeReaction(path, emoji, currentUserId, reaction.isLegacyCount);
    } else {
      await this.messageLogic.addReaction(path, emoji, currentUserId, reaction.isLegacyCount);
    }
  }
}
