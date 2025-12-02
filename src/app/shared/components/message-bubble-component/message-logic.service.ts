import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, deleteField } from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
  currentUserReacted: boolean;
  isLegacyCount: boolean;
}

@Injectable({ providedIn: 'root' })
export class MessageLogicService {
  private nameCache = new Map<string, string>();
  private subscribedUids = new Set<string>();
  private userLoadQueue = new Set<string>();
  private userLoadSubject = new Subject<void>();
  /** Callback invoked when new user names arrive so component can rebuild reactions */
  onNamesUpdated?: () => void;

  constructor(private firestore: Firestore, private userService: UserService) {
    // Process batched user lookups every 300ms to reduce Firestore reads
    this.userLoadSubject
      .pipe(debounceTime(300))
      .subscribe(() => this.processBatchedUserLoads());
  }

  /**
   * Build the Firestore document path for a message.
   * @param collectionName The collection type ('channels' or 'dms').
   * @param chatId The chat/channel ID.
   * @param messageId The message ID.
   * @param isThreadView Whether this is a thread message.
   * @param parentMessageId The parent message ID if in thread view.
   * @returns The Firestore path string or null if required params missing.
   */
  buildMessageDocPath(collectionName: 'channels' | 'dms', chatId: string | undefined, messageId: string | undefined, isThreadView: boolean, parentMessageId?: string): string | null {
    if (!collectionName || !chatId || !messageId) return null;
    if (isThreadView && parentMessageId) {
      return `${collectionName}/${chatId}/messages/${parentMessageId}/thread/${messageId}`;
    }
    return `${collectionName}/${chatId}/messages/${messageId}`;
  }

  /**
   * Truncate first and last name to max 12 characters each with ellipsis.
   * @param name The full name to truncate.
   * @returns Truncated name in format "First… Last…" or single truncated name.
   */
  truncateFullName(name: string): string {
    const cleaned = (name || '').toString().trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const parts = cleaned.split(' ');
    const trunc = (s: string) => (s.length > 12 ? s.slice(0, 12) + '…' : s);
    if (parts.length === 1) return trunc(parts[0]);
    const first = trunc(parts[0]);
    const last = trunc(parts[parts.length - 1]);
    return first === last ? first : `${first} ${last}`;
  }

  /**
   * Rebuild reactions array from Firestore reactionsMap.
   * @param reactionsMap The raw reactions data (emoji -> count or userIds map).
   * @param currentUserId The current user's ID to determine if they reacted.
   * @returns Array of MessageReaction objects sorted by count descending.
   * Side effects: triggers user name loading for reaction userIds.
   */
  rebuildReactions(reactionsMap: Record<string, number | Record<string, true>> | null | undefined, currentUserId: string | null): MessageReaction[] {
    const map = reactionsMap || {};
    const out: MessageReaction[] = [];
    for (const [emoji, value] of Object.entries(map)) {
      if (typeof value === 'number') this.processLegacyReaction(emoji, value, out);
      else if (value && typeof value === 'object') this.processUserMapReaction(emoji, value as Record<string, true>, currentUserId, out);
    }
    return out.sort((a, b) => b.count - a.count);
  }

  /**
   * Process legacy reaction format (emoji -> number count).
   * @param emoji The unicode emoji string.
   * @param raw The raw count value.
   * @param out The output array to push the reaction into.
   * Side effects: adds legacy reaction to output array if count > 0.
   */
  private processLegacyReaction(emoji: string, raw: number, out: MessageReaction[]) {
    const count = Math.max(0, Number(raw));
    if (count > 0) out.push({ emoji, count, userIds: [], userNames: [], currentUserReacted: false, isLegacyCount: true });
  }

  /**
   * Process modern reaction format (emoji -> {userId: true} map).
   * @param emoji The unicode emoji string.
   * @param mapValue The userId map object.
   * @param uid The current user's ID.
   * @param out The output array to push the reaction into.
   * Side effects: loads user names, adds reaction to output array.
   */
  private processUserMapReaction(emoji: string, mapValue: Record<string, true>, uid: string | null, out: MessageReaction[]) {
    const userIds = Object.keys(mapValue);
    const count = userIds.length;
    if (!count) return;
    this.ensureNamesLoaded(userIds);
    const userNames = userIds.map(id => this.truncateFullName(this.nameCache.get(id) || ''));
    out.push({ emoji, count, userIds, userNames, currentUserReacted: !!uid && userIds.includes(uid), isLegacyCount: false });
  }

  /**
   * Ensure user names are loaded for given user IDs.
   * Batches requests to reduce Firestore reads.
   * @param uids Array of user IDs to load names for.
   * Side effects: queues user loads, triggers batch processing after debounce.
   */
  private ensureNamesLoaded(uids: string[]) {
    for (const id of uids) {
      if (this.nameCache.has(id) || this.subscribedUids.has(id)) continue;
      // Queue for batched loading instead of immediate subscription
      this.userLoadQueue.add(id);
    }
    // Trigger debounced batch processing
    if (this.userLoadQueue.size > 0) {
      this.userLoadSubject.next();
    }
  }

  /**
   * Process batched user loads to minimize Firestore reads.
   * Subscribes to all queued user IDs at once.
   * Side effects: subscribes to user data, updates nameCache, triggers onNamesUpdated callback.
   */
  private processBatchedUserLoads(): void {
    const uids = Array.from(this.userLoadQueue);
    this.userLoadQueue.clear();

    for (const id of uids) {
      if (this.subscribedUids.has(id)) continue;
      this.subscribedUids.add(id);
      this.userService.userById$(id).subscribe((u: any) => {
        if (u) this.nameCache.set(id, String(u.name ?? ''));
        this.onNamesUpdated?.();
      });
    }
  }

  /**
   * Add a reaction to a message in Firestore.
   * @param path The Firestore document path.
   * @param emoji The unicode emoji string to add.
   * @param currentUserId The current user's ID.
   * @param legacy Whether to use legacy format (replaces entire emoji object).
   * Side effects: updates Firestore document.
   */
  async addReaction(path: string | null, emoji: string, currentUserId: string, legacy = false): Promise<void> {
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      if (legacy) {
        await updateDoc(ref, { [`reactions.${emoji}`]: { [currentUserId]: true } });
      } else {
        await updateDoc(ref, { [`reactions.${emoji}.${currentUserId}`]: true });
      }
    } catch {}
  }

  /**
   * Remove a reaction from a message in Firestore.
   * @param path The Firestore document path.
   * @param emoji The unicode emoji string to remove.
   * @param currentUserId The current user's ID.
   * @param legacy Whether to use legacy format (deletes entire emoji field).
   * Side effects: updates Firestore document.
   */
  async removeReaction(path: string | null, emoji: string, currentUserId: string, legacy = false): Promise<void> {
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      if (legacy) {
        await updateDoc(ref, { [`reactions.${emoji}`]: deleteField() });
      } else {
        await updateDoc(ref, { [`reactions.${emoji}.${currentUserId}`]: deleteField() });
      }
    } catch {}
  }

  /**
   * Save edited message text to Firestore.
   * @param path The Firestore document path.
   * @param newText The new message text.
   * Side effects: updates message text and sets edited flag in Firestore.
   */
  async saveEditedText(path: string | null, newText: string): Promise<void> {
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      await updateDoc(ref, { text: newText, edited: true });
    } catch {}
  }

  /**
   * Soft delete a message by replacing text with placeholder.
   * @param path The Firestore document path.
   * @param deletedPlaceholder The placeholder text for deleted messages.
   * Side effects: updates message text, sets deleted flag, removes all reactions in Firestore.
   */
  async softDeleteMessage(path: string | null, deletedPlaceholder: string): Promise<void> {
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      await updateDoc(ref, { text: deletedPlaceholder, deleted: true, reactions: deleteField() });
    } catch {}
  }
}
