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

  // Services
  private userService = inject(UserService);
  private channelService = inject(ChannelService);

  async ngOnInit() {
    // Daten wie in deiner Message-Area laden
    const users = await firstValueFrom(this.userService.users$());
    this.mentionUsers = users.map(u => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
    }));

    const channels = await firstValueFrom(this.channelService.channels$());
    this.mentionChannels = channels;
  }

  // @ oder # gedrückt -> Liste öffnen/umschalten
  onRecipientKeyDown(e: KeyboardEvent) {
    if (e.key === '@' || e.key === '#') {
      this.mentionMode = e.key === '@' ? 'users' : 'channels';
      this.showMention = true;
      // mentionSearch wird im onRecipientInput() aus dem aktuellen Wort gesetzt
      return;
    }
    if (e.key === 'Escape' && this.showMention) {
      this.showMention = false;
      return;
    }
  }

  // bei jedem Input prüfen, ob wir gerade in einem @foo / #bar-Token sind
  onRecipientInput() {
    const val = this.recipientText || '';
    const trimmed = val.trimEnd();
    const match = /(^|\s)([@#])([^\s@#]*)$/i.exec(trimmed);
    if (this.recipientFocused && match) {
      this.mentionMode = match[2] === '@' ? 'users' : 'channels';
      this.mentionSearch = match[3]; // ohne Präfix
      this.showMention = true;
    } else {
      this.showMention = false;
      this.mentionSearch = '';
    }
  }

  onRecipientBlur() {
    // kleinen Delay, damit Klick auf die Liste noch durchkommt
    setTimeout(() => {
      this.recipientFocused = false;
      this.showMention = false;
    }, 120);
  }

  // Klick außerhalb schließt die Liste
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.recipientFocused && this.showMention) {
      this.showMention = false;
    }
  }

  // Auswahl aus der Liste ersetzt das aktuelle Token
  insertMention(insertValue: string) {
    const cur = this.recipientText || '';
    this.recipientText = cur.replace(
      /(^|\s)[@#][^\s@#]*$/i,
      (_m, g1) => `${g1}${insertValue}`
    );
    this.showMention = false;
  }

  onMentionUserPicked(u: MentionUser) {
    // Optional: hier kannst du "picked" setzen, wenn du magst
    // console.log('User ausgewählt:', u);
  }

  onMentionChannelPicked(c: MentionChannel) {
    // Optional: Channel-Reaktion
    // console.log('Channel ausgewählt:', c);
  }
}