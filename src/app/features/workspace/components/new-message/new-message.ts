import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { firstValueFrom } from 'rxjs';

import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import {
  MentionListComponent,
  MentionUser,
  MentionChannel,
} from '../../../../shared/components/mention-list.component/mention-list.component';

import { UserService } from '../../../../../services/user.service';
import { ChannelService } from '../../../../../services/channel.service';

@Component({
  selector: 'app-new-message',
  standalone: true,
  templateUrl: './new-message.html',
  styleUrls: ['./new-message.scss'],
  imports: [CommonModule, FormsModule, MessageAreaComponent, MentionListComponent],
})
export class NewMessageComponent implements OnInit {
  // ---- Mention-Input-State ----
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

  private userService = inject(UserService);
  private channelService = inject(ChannelService);

  async ngOnInit() {
    const users = await firstValueFrom(this.userService.users$());
    this.mentionUsers = users.map((u) => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
      email: u.email || '',
    }));

    const channels = await firstValueFrom(this.channelService.channels$());
    this.mentionChannels = channels;
  }

  onRecipientKeyDown(e: KeyboardEvent) {
    if (e.key === '@' || e.key === '#') {
      this.mentionMode = e.key === '@' ? 'users' : 'channels';
      this.showMention = true;
      this.pendingPrefix = e.key as '@' | '#'; 
      return;
    }
    if (e.key === 'Escape' && this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
      return;
    }
  }

  // bei jedem Input prüfen, ob wir gerade in einem @foo / #bar-Token sind
  onRecipientInput() {
    const val = this.recipientText || '';
    const trimmed = val.trimEnd();
    const mentionMatch = /(^|\s)([@#])([^\s@#]*)$/i.exec(trimmed);
    if (this.recipientFocused && mentionMatch) {
      this.mentionMode = mentionMatch[2] === '@' ? 'users' : 'channels';
      this.mentionSearch = mentionMatch[3];
      this.showMention = true;
      this.pendingPrefix =
        this.mentionSearch.length === 0 ? (this.mentionMode === 'users' ? '@' : '#') : null;
      return;
    }

    const token = this.getLastToken(trimmed);
    if (this.recipientFocused && this.isLikelyEmail(token)) {
      this.mentionMode = 'users';
      this.mentionSearch = token;
      this.showMention = true;
      this.pendingPrefix = null;
      return;
    }

    if (
      this.recipientFocused &&
      this.openOnFreeText &&
      token.length >= this.minTokenLen &&
      !token.startsWith('#')
    ) {
      this.mentionMode = 'users';
      this.mentionSearch = token;
      this.showMention = true;
      this.pendingPrefix = null; 
      return;
    }

    this.showMention = false;
    this.mentionSearch = '';
    this.pendingPrefix = null;
  }

  private getLastToken(s: string): string {
    const parts = s.split(/\s+/);
    return parts[parts.length - 1] || '';
  }

  private isLikelyEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  }
  onRecipientBlur() {
    setTimeout(() => {
      this.recipientFocused = false;
      this.showMention = false;
      this.revertPendingPrefixIfAny();
    }, 120);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(_ev: MouseEvent) {
    if (!this.recipientFocused && this.showMention) {
      this.showMention = false;
    }
    if (!this.recipientFocused) {
      this.revertPendingPrefixIfAny(); 
    }
  }

  insertMention(insertValue: string) {
    const cur = this.recipientText || '';
    this.recipientText = cur.replace(
      /(^|\s)(?:[@#][^\s@#]*|[^\s@]+@[^\s@]+\.[^\s@]+|[^\s]+)$/i,
      (_m, g1) => `${g1}${insertValue}`
    );
    this.showMention = false;
    this.pendingPrefix = null;
  }

  private revertPendingPrefixIfAny() {
    if (!this.pendingPrefix) return;

    const s = (this.recipientText || '').trimEnd();
    const lastToken = this.getLastToken(s);

    if (lastToken === this.pendingPrefix) {
      this.recipientText = s.replace(/(\s)?[@#]$/i, '').trimEnd();
    }

    this.pendingPrefix = null;
  }

  onMentionUserPicked(u: MentionUser) {
    console.log('User ausgewählt:', u);
  }
}
