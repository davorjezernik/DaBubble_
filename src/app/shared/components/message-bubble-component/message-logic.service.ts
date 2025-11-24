import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, deleteField } from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';

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
  /** Callback invoked when new user names arrive so component can rebuild reactions */
  onNamesUpdated?: () => void;

  constructor(private firestore: Firestore, private userService: UserService) {}

  buildMessageDocPath(collectionName: 'channels' | 'dms', chatId: string | undefined, messageId: string | undefined, isThreadView: boolean, parentMessageId?: string): string | null {
    if (!collectionName || !chatId || !messageId) return null;
    if (isThreadView && parentMessageId) {
      return `${collectionName}/${chatId}/messages/${parentMessageId}/thread/${messageId}`;
    }
    return `${collectionName}/${chatId}/messages/${messageId}`;
  }

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

  rebuildReactions(reactionsMap: Record<string, number | Record<string, true>> | null | undefined, currentUserId: string | null): MessageReaction[] {
    const map = reactionsMap || {};
    const out: MessageReaction[] = [];
    for (const [emoji, value] of Object.entries(map)) {
      if (typeof value === 'number') this.processLegacyReaction(emoji, value, out);
      else if (value && typeof value === 'object') this.processUserMapReaction(emoji, value as Record<string, true>, currentUserId, out);
    }
    return out.sort((a, b) => b.count - a.count);
  }

  private processLegacyReaction(emoji: string, raw: number, out: MessageReaction[]) {
    const count = Math.max(0, Number(raw));
    if (count > 0) out.push({ emoji, count, userIds: [], userNames: [], currentUserReacted: false, isLegacyCount: true });
  }

  private processUserMapReaction(emoji: string, mapValue: Record<string, true>, uid: string | null, out: MessageReaction[]) {
    const userIds = Object.keys(mapValue);
    const count = userIds.length;
    if (!count) return;
    this.ensureNamesLoaded(userIds);
    const userNames = userIds.map(id => this.truncateFullName(this.nameCache.get(id) || ''));
    out.push({ emoji, count, userIds, userNames, currentUserReacted: !!uid && userIds.includes(uid), isLegacyCount: false });
  }

  private ensureNamesLoaded(uids: string[]) {
    for (const id of uids) {
      if (this.nameCache.has(id) || this.subscribedUids.has(id)) continue;
      this.subscribedUids.add(id);
      this.userService.userById$(id).subscribe((u: any) => {
        if (u) this.nameCache.set(id, String(u.name ?? ''));
        this.onNamesUpdated?.();
      });
    }
  }

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

  async saveEditedText(path: string | null, newText: string): Promise<void> {
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      await updateDoc(ref, { text: newText, edited: true });
    } catch {}
  }

  async softDeleteMessage(path: string | null, deletedPlaceholder: string): Promise<void> {
    if (!path) return;
    try {
      const ref = doc(this.firestore, path);
      await updateDoc(ref, { text: deletedPlaceholder, deleted: true, reactions: deleteField() });
    } catch {}
  }
}
