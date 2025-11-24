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

  rebuildReactions(reactionsMap: Record<string, number | Record<string, true>> | null | undefined, currentUserId: string | null) {
    const reactions = this.messageLogic.rebuildReactions(reactionsMap, currentUserId);
    this._reactions.next(reactions);
  }

  toggleEmojiPicker() {
    this._showEmojiPicker.next(!this._showEmojiPicker.value);
  }

  openEmojiPicker() {
    this._showEmojiPicker.next(true);
  }

  closeEmojiPicker() {
    this._showEmojiPicker.next(false);
  }

  toggleEditEmojiPicker() {
    this._editEmojiPickerVisible.next(!this._editEmojiPickerVisible.value);
  }

  closeEditEmojiPicker() {
    this._editEmojiPickerVisible.next(false);
  }

  async addOrIncrementReaction(path: string | null, emoji: string, currentUserId: string) {
    if (!path) return;
    await this.messageLogic.addReaction(path, emoji, currentUserId);
    this.closeEmojiPicker();
  }

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
