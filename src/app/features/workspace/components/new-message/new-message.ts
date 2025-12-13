import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import {
  MentionListComponent,
  MentionUser,
  MentionChannel,
} from '../../../../shared/components/mention-list.component/mention-list.component';
import { UserService } from '../../../../../services/user.service';
import { AuthService } from '../../../../../services/auth-service';
import { ChannelService } from '../../../../../services/channel-service';
import { Router } from '@angular/router';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
} from '@angular/fire/firestore';
import { firstValueFrom, filter, take } from 'rxjs';
import { User } from '@angular/fire/auth';

type Target = { kind: 'dm' | 'channel'; id: string; label: string };

@Component({
  selector: 'app-new-message',
  standalone: true,
  templateUrl: './new-message.html',
  styleUrls: ['./new-message.scss', './new-message.responsiv.scss'],
  imports: [CommonModule, FormsModule, MessageAreaComponent, MentionListComponent],
})
export class NewMessageComponent implements OnInit {
  recipientText = '';
  showMention = false;
  mentionMode: 'users' | 'channels' = 'users';
  mentionSearch = '';
  mentionUsers: MentionUser[] = [];
  mentionChannels: MentionChannel[] = [];
  recipientFocused = false;
  openOnFreeText = true;
  minTokenLen = 2;
  pendingPrefix: '@' | '#' | null = null;
  isPicking = false;

  selectedTargets: Target[] = [];

  private userService = inject(UserService);
  private channelService = inject(ChannelService);

  constructor(private router: Router, private firestore: Firestore, private auth: AuthService) {}

  /** Initializes the component by loading users and channels for the mention list. */
  async ngOnInit() {
    await this.loadMentionUsers();
    const myUid = await this.getCurrentUserId();
    const myChannels = await this.getChannelsForUser(myUid);

    this.mentionChannels = myChannels.map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
  }

  /** Fetches channels from the ChannelService that the specified user is a member of. */
  private async getChannelsForUser(myUid: string) {
    const allChannels = await firstValueFrom(this.channelService.getChannels());
    return (allChannels ?? []).filter((c: any) => {
      const raw = c?.members ?? c?.memberIds ?? [];
      if (!Array.isArray(raw)) return false;
      return raw.some((m: any) => {
        if (typeof m === 'string') return m === myUid;
        const uid = m?.uid ?? m?.userId ?? m?.user?.uid ?? null;
        return uid === myUid;
      });
    });
  }

  /** Retrieves the UID of the currently authenticated user. */
  private async getCurrentUserId() {
    const me = await firstValueFrom(
      this.auth.currentUser$.pipe(
        filter((u): u is User => u != null),
        take(1)
      )
    );
    return me.uid;
  }

  /** Loads all users from the UserService and maps them to the MentionUser format. */
  private async loadMentionUsers() {
    const users = await firstValueFrom(this.userService.users$());
    this.mentionUsers = users.map((u) => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
      email: u.email || '',
    }));
  }

  /** Handles keydown events in the recipient input for special keys like '@', '#', 'Enter', and 'Escape'. */
  onRecipientKeyDown(e: KeyboardEvent) {
    if (e.key === '@' || e.key === '#') return this.activateMentionMode(e);

    if (e.key === 'Enter') {
      e.preventDefault();
      const t = this.resolveTargetFromRecipient();
      if (t) return this.applyRecipientTarget(t);
    }

    if (e.key === 'Escape' && this.showMention) return this.closeMention();
  }

  /** Closes the mention list and reverts any pending prefix. */
  private closeMention() {
    this.showMention = false;
    this.revertPendingPrefixIfAny();
  }

  /** Adds a resolved target to the selection and resets the input field. */
  private applyRecipientTarget(t: Target) {
    if (t.kind === 'dm') {
      this.addTargetIfNotExists({ kind: 'dm', id: t.id, label: t.label });
    } else {
      this.addTargetIfNotExists({ kind: 'channel', id: t.id, label: t.label });
    }
    this.resetMentionStates();
  }

  /** Resets the recipient input and hides the mention list. */
  private resetMentionStates() {
    this.recipientText = '';
    this.showMention = false;
    this.pendingPrefix = null;
  }

  /** Activates mention mode ('users' or 'channels') based on the key pressed. */
  private activateMentionMode(e: KeyboardEvent) {
    this.mentionMode = e.key === '@' ? 'users' : 'channels';
    this.showMention = true;
    this.pendingPrefix = e.key as '@' | '#';
  }

  /** Handles the input event to control the visibility and filtering of the mention list. */
  onRecipientInput() {
    const { trimmed, mentionMatch } = this.parseRecipientInput();
    if (this.recipientFocused && mentionMatch) return this.handleMentionMatch(mentionMatch);

    const token = this.getLastToken(trimmed);
    if (this.recipientFocused && this.isLikelyEmail(token)) return this.setUsersMentionMode(token);
    if (this.isFreeTextTrigger(token)) return this.setUsersMentionMode(token);
    this.resetMentionSearch();
  }

  /** Determines if the current input token should trigger the mention list for users. */
  private isFreeTextTrigger(token: string): boolean {
    return (
      this.recipientFocused &&
      this.openOnFreeText &&
      token.length >= this.minTokenLen &&
      !token.startsWith('#')
    );
  }

  /** Sets the mention list to 'users' mode with the given search token. */
  private setUsersMentionMode(token: string) {
    this.mentionMode = 'users';
    this.mentionSearch = token;
    this.showMention = true;
    this.pendingPrefix = null;
  }

  /** Resets the mention search state, hiding the list. */
  private resetMentionSearch() {
    this.showMention = false;
    this.mentionSearch = '';
    this.pendingPrefix = null;
  }

  /** Parses the current recipient input text to find mention triggers. */
  private parseRecipientInput() {
    const val = this.recipientText || '';
    const trimmed = val.trimEnd();
    const mentionMatch = /(^|\s)([@#])([^\s@#]*)$/i.exec(trimmed);
    return { trimmed, mentionMatch };
  }

  /** Handles a successful mention trigger match, configuring and showing the mention list. */
  private handleMentionMatch(mentionMatch: any) {
    this.mentionMode = mentionMatch[2] === '@' ? 'users' : 'channels';
    this.mentionSearch = mentionMatch[3];
    this.showMention = true;
    this.pendingPrefix =
      this.mentionSearch.length === 0 ? (this.mentionMode === 'users' ? '@' : '#') : null;
  }

  /** Extracts the last word from a string. */
  private getLastToken(s: string): string {
    const parts = s.split(/\s+/);
    return parts[parts.length - 1] || '';
  }

  /** Checks if a string is likely a valid email address. */
  private isLikelyEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  }

  /** Handles the blur event on the recipient input to close the mention list. */
  onRecipientBlur() {
    setTimeout(() => {
      if (this.isPicking) return;
      this.recipientFocused = false;
      this.showMention = false;
      this.revertPendingPrefixIfAny();
    }, 120);
  }

  /** Handles clicks outside the component to close the mention list. */
  @HostListener('document:click', ['$event'])
  onDocClick(_ev: MouseEvent) {
    if (!this.recipientFocused && this.showMention) {
      this.showMention = false;
    }
    if (!this.recipientFocused) {
      this.revertPendingPrefixIfAny();
    }
  }

  /** Inserts a selected mention value into the input and resolves it as a target. */
  insertMention(insertValue: string) {
    this.replaceActiveMention(this.recipientText, insertValue);
    const t = this.resolveTargetFromRecipient();
    if (t) this.applyMentionTarget(t);
    this.showMention = false;
    this.pendingPrefix = null;
  }

  /** Adds a resolved mention target to the selection and clears the input. */
  private applyMentionTarget(t: Target) {
    if (t.kind === 'dm') {
      this.addTargetIfNotExists({ kind: 'dm', id: t.id, label: t.label });
    } else {
      this.addTargetIfNotExists({ kind: 'channel', id: t.id, label: t.label });
    }
    this.recipientText = '';
  }

  /** Replaces the currently active token in the input with the selected mention value. */
  private replaceActiveMention(cur: string, insertValue: string) {
    this.recipientText = cur.replace(
      /(^|\s)(?:[@#][^\s@#]*|[^\s@]+@[^\s@]+\.[^\s@]+|[^\s]+)$/i,
      (_m, g1) => `${g1}${insertValue}`
    );
  }

  /** Removes a pending '@' or '#' prefix if the input is empty. */
  private revertPendingPrefixIfAny() {
    if (!this.pendingPrefix) return;

    const s = (this.recipientText || '').trimEnd();
    const lastToken = this.getLastToken(s);

    if (lastToken === this.pendingPrefix) {
      this.recipientText = s.replace(/(\s)?[@#]$/i, '').trimEnd();
    }

    this.pendingPrefix = null;
  }

  /** Handles the selection of a user from the mention list. */
  onMentionUserPicked(u: MentionUser) {
    this.addTargetIfNotExists({ kind: 'dm', id: u.uid, label: `@${u.name}` });
    this.recipientText = '';
    this.showMention = false;
    this.pendingPrefix = null;
  }

  /** Handles the selection of a channel from the mention list. */
  onMentionChannelPicked(c: MentionChannel) {
    this.addTargetIfNotExists({ kind: 'channel', id: c.id, label: `#${c.name}` });
    this.recipientText = '';
    this.showMention = false;
    this.pendingPrefix = null;
  }

  /** Adds a target to the selection if it's not already present. */
  private addTargetIfNotExists(t: Target) {
    const exists = this.selectedTargets.some((x) => x.kind === t.kind && x.id === t.id);
    if (!exists) this.selectedTargets.push(t);
  }

  /** Removes a target from the selection. */
  removeTarget(t: Target) {
    this.selectedTargets = this.selectedTargets.filter(
      (x) => !(x.kind === t.kind && x.id === t.id)
    );
  }

  /** Sends the message to all selected targets and redirects if only one target is selected. */
  async handleSendFromFooter(text: string) {
    const clean = text?.trim();
    if (!clean || this.selectedTargets.length === 0) return;
    for (const t of this.selectedTargets) {
      await this.sendMessageToTarget(t, clean);
    }
    if (this.selectedTargets.length === 1) await this.redirectToTarget();
  }

  /** Navigates to the conversation view for the single selected target. */
  private async redirectToTarget() {
    const only = this.selectedTargets[0];
    if (only.kind === 'dm') {
      const myUid = await this.getMyUid();
      const dmId = this.buildDmId(myUid, only.id);
      this.router.navigate(['/workspace', 'dm', dmId]);
    } else {
      this.router.navigate(['/workspace', 'channel', only.id]);
    }
  }

  /** Dispatches the message sending to the appropriate handler based on target type. */
  private async sendMessageToTarget(t: Target, clean: string) {
    if (t.kind === 'dm') {
      await this.sendToDm(t.id, clean);
    } else {
      await this.sendToChannel(t.id, clean);
    }
  }

  /** Resolves a target from the raw input string by checking for channels, mentions, emails, or names. */
  private resolveTargetFromRecipient(): Target | null {
    const raw = (this.recipientText || '').trim();
    if (!raw) return null;

    return (
      this.resolveChannelFromRaw(raw) ??
      this.resolveUserByAtMention(raw) ??
      this.resolveUserByEmail(raw) ??
      this.resolveUserFallback(raw)
    );
  }

  /** Attempts to resolve a channel from the raw input string. */
  private resolveChannelFromRaw(raw: string): Target | null {
    const channel = this.mentionChannels.find(
      (c) =>
        raw.toLowerCase().includes(`#${c.name.toLowerCase()}`) ||
        raw.toLowerCase() === c.name.toLowerCase()
    );

    return channel ? { kind: 'channel', id: channel.id, label: `#${channel.name}` } : null;
  }

  /** Attempts to resolve a user from a full '@' mention in the raw input string. */
  private resolveUserByAtMention(raw: string): Target | null {
    const user = this.mentionUsers.find((u) =>
      raw.toLowerCase().includes(`@${u.name.toLowerCase()}`)
    );

    return user ? { kind: 'dm', id: user.uid, label: `@${user.name}` } : null;
  }

  /** Attempts to resolve a user from an email address in the raw input string. */
  private resolveUserByEmail(raw: string): Target | null {
    const mailMatch = raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (!mailMatch) return null;

    const mail = mailMatch[0].toLowerCase();
    const user = this.mentionUsers.find((u) => (u.email || '').toLowerCase() === mail);

    if (!user) return null;

    return {
      kind: 'dm',
      id: user.uid,
      label: `@${user.name}`,
    };
  }

  /** A fallback that attempts to resolve a user by a partial '@' token or exact name match. */
  private resolveUserFallback(raw: string): Target | null {
    const tokenMatch = raw.match(/@([^\s]+)/);
    if (tokenMatch) {
      const token = tokenMatch[1].toLowerCase();
      const byToken = this.mentionUsers.find((u) => u.name.toLowerCase().startsWith(token));
      if (byToken) {
        return { kind: 'dm', id: byToken.uid, label: `@${byToken.name}` };
      }
    }

    const exact = this.mentionUsers.find((u) => u.name.toLowerCase() === raw.toLowerCase());

    return exact ? { kind: 'dm', id: exact.uid, label: `@${exact.name}` } : null;
  }

  /** Retrieves the UID of the currently authenticated user. */
  private async getMyUid(): Promise<string> {
    const me = await firstValueFrom(this.auth.currentUser$);
    return me?.uid || '';
  }

  /** Creates a stable, sorted ID for a direct message conversation. */
  private buildDmId(a: string, b: string) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  /** Sends a direct message, creating the DM document if it doesn't exist. */
  private async sendToDm(otherUid: string, text: string) {
    const myUid = await this.getMyUid();
    if (!myUid || !otherUid) return;

    const { dmId, dmRef, dmSnap } = await this.loadDmContext(myUid, otherUid);
    await this.ensureDmDocument(dmRef, myUid, otherUid, dmSnap);
    await this.saveDmMessage(dmId, myUid, text);
  }

  /** Ensures a DM document exists, creating or updating it as needed. */
  private async ensureDmDocument(dmRef: any, myUid: string, otherUid: string, dmSnap: any) {
    if (!dmSnap.exists()) {
      await setDoc(dmRef, {
        members: [myUid, otherUid],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      });
    } else {
      await setDoc(dmRef, { lastMessageAt: serverTimestamp() }, { merge: true });
    }
  }

  /** Saves a new message to a DM conversation. */
  private async saveDmMessage(dmId: string, myUid: string, text: string) {
    await addDoc(collection(this.firestore, `dms/${dmId}/messages`), {
      text,
      authorId: myUid,
      timestamp: serverTimestamp(),
    });
  }

  /** Loads the context (ID, reference, snapshot) for a DM conversation. */
  private async loadDmContext(myUid: string, otherUid: string) {
    const dmId = this.buildDmId(myUid, otherUid);
    const dmRef = doc(this.firestore, `dms/${dmId}`);
    const dmSnap = await getDoc(dmRef);
    return { dmId, dmRef, dmSnap };
  }

  /** Sends a message to a channel. */
  private async sendToChannel(channelId: string, text: string) {
    const myUid = await this.getMyUid();
    if (!myUid || !channelId) return;

    await addDoc(collection(this.firestore, `channels/${channelId}/messages`), {
      text,
      authorId: myUid,
      timestamp: serverTimestamp(),
    });
  }

  /** Returns a filtered list of users, excluding those already selected as targets. */
  get filteredMentionUsers() {
    return this.mentionUsers.filter(
      (u) => !this.selectedTargets.some((t) => t.kind === 'dm' && t.id === u.uid)
    );
  }

  /** Returns a filtered list of channels, excluding those already selected as targets. */
  get filteredMentionChannels() {
    return this.mentionChannels.filter(
      (c) => !this.selectedTargets.some((t) => t.kind === 'channel' && t.id === c.id)
    );
  }
}
