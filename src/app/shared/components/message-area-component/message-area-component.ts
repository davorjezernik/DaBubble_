import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import { SharedComponentsModule } from '../shared-components/shared-components-module';
import { UserService } from './../../../../services/user.service';
import { ChannelService } from './../../../../services/channel.service';
import { firstValueFrom } from 'rxjs';
import { MentionListComponent, MentionUser, MentionChannel } from '../mention-list.component/mention-list.component';
import { Renderer2, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-message-area-component',
  standalone: true,
  imports: [CommonModule, FormsModule, EmojiPickerComponent, SharedComponentsModule, MentionListComponent
  ],
  templateUrl: './message-area-component.html',
  styleUrl: './message-area-component.scss',
})
export class MessageAreaComponent {
  @Input() hint = 'Nachricht an #Team';
  @Input() disabled = false;
  @Input() maxHeight = 240;
  @Output() send = new EventEmitter<string>();

  text = '';
  focused = false;

  @ViewChild('ta') ta!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('root') root!: ElementRef<HTMLElement>;

  @Input() channelName = '';
  @Input() mode: 'channel' | 'thread' = 'channel';

  // Mention-Panel
  showMention = false;
  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];
  mentionChannels: MentionChannel[] = [];

  /** Merkt sich, ob wir automatisch ein Präfix eingesetzt haben.
   * Wird beim Outside-Click wieder entfernt, wenn keine Auswahl erfolgte. */
  private pendingPrefix: '@' | '#' | null = null;

  constructor(
    private usersService: UserService,
    private channelsService: ChannelService,
  ) { }

  async ngOnInit() {
    const users = await firstValueFrom(this.usersService.users$());
    this.mentionUsers = users.map(u => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online
    }));

    const channels = await firstValueFrom(this.channelsService.channels$());
    this.mentionChannels = channels;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Klicks innerhalb der Message-Area ignorieren
    if (this.root?.nativeElement.contains(target)) return;

    // Panel schließen
    if (this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
    }
  }

  toggleMentionMode() {
    // 1. Klick: öffnen mit Users + '@'
    if (!this.showMention) {
      this.mentionMode = 'users';
      this.showMention = true;
      this.setOrSwapPrefix('@');
      this.pendingPrefix = '@';
      return;
    }
    // 2. Klick: Channels + '#'
    if (this.mentionMode === 'users') {
      this.mentionMode = 'channels';
      this.setOrSwapPrefix('#');
      this.pendingPrefix = '#';
    } else {
      // 3. Klick: zurück zu Users + '@'
      this.mentionMode = 'users';
      this.setOrSwapPrefix('@');
      this.pendingPrefix = '@';
    }
  }

  insertMention(value: string) {
    this.replacePrefixWith(value);
    this.showMention = false;
    this.pendingPrefix = null; // endgültig eingesetzt
  }

  private insertAtCursor(insert: string) {
    const el = this.ta?.nativeElement;
    if (!el) { this.text += insert; return; }

    const start = el.selectionStart ?? this.text.length;
    const end = el.selectionEnd ?? this.text.length;
    const before = this.text.slice(0, start);
    const after = this.text.slice(end);
    this.text = before + insert + after;

    queueMicrotask(() => {
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
      this.autoResize(el);
    });
  }

  private setOrSwapPrefix(prefix: '@' | '#') {
    const el = this.ta?.nativeElement;
    if (!el) { this.text += prefix; return; }

    let pos = el.selectionStart ?? this.text.length;

    // Direkt davor schon ein Präfix? → ersetzen
    if (pos > 0 && (this.text[pos - 1] === '@' || this.text[pos - 1] === '#')) {
      this.text = this.text.slice(0, pos - 1) + prefix + this.text.slice(pos);
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
        this.autoResize(el);
      });
      return;
    }

    // Sonst ggf. Space + Präfix einsetzen
    const needsSpace = pos > 0 && /\S/.test(this.text[pos - 1]);
    const insert = (needsSpace ? ' ' : '') + prefix;
    this.insertAtCursor(insert);
  }

  private replacePrefixWith(value: string) {
    const el = this.ta?.nativeElement;
    if (!el) { this.text += value; return; }

    const start = el.selectionStart ?? this.text.length;
    const end = el.selectionEnd ?? this.text.length;

    let from = start, to = end;
    if (from > 0 && (this.text[from - 1] === '@' || this.text[from - 1] === '#')) {
      from = from - 1;
    }

    this.text = this.text.slice(0, from) + value + this.text.slice(to);

    queueMicrotask(() => {
      el.focus();
      const pos = from + value.length;
      el.setSelectionRange(pos, pos);
      this.autoResize(el);
    });
  }

  /** Entfernt ein automatisch gesetztes Präfix, wenn keine Auswahl erfolgte */
  private revertPendingPrefixIfAny() {
    if (!this.pendingPrefix) return;

    const el = this.ta?.nativeElement;
    if (!el) { this.pendingPrefix = null; return; }

    const pos = el.selectionStart ?? this.text.length;
    const prev = pos > 0 ? this.text[pos - 1] : '';

    // Nur entfernen, wenn wirklich direkt das Präfix steht
    if (prev === this.pendingPrefix) {
      // Entferne evtl. vorangestelltes Leerzeichen + Präfix
      const before = this.text.slice(0, pos - 1);
      const after = this.text.slice(pos);

      // war vor dem Präfix ein Space?
      const beforePrev = before.slice(-1);
      if (beforePrev === ' ') {
        this.text = before.slice(0, -1) + after;
        queueMicrotask(() => {
          el.setSelectionRange(pos - 2, pos - 2);
        });
      } else {
        this.text = before + after;
        queueMicrotask(() => {
          el.setSelectionRange(pos - 1, pos - 1);
        });
      }
    }

    this.pendingPrefix = null;
  }

  get hintText(): string {
    return this.mode === 'thread'
      ? 'Antworten'
      : this.channelName
        ? `Nachricht an #${this.channelName}`
        : 'Nachricht an #Team';
  }

  autoResize(el: HTMLTextAreaElement) {
    const baseHeight = 56;
    el.style.height = baseHeight + 'px';
    const next = Math.min(el.scrollHeight, this.maxHeight);
    el.style.height = next + 'px';
  }

  onKeyDown(e: KeyboardEvent) {
  if ((e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    this.triggerSend();
  }
}

  onEnter(e: KeyboardEvent) {
    if (!e.shiftKey) {
      this.triggerSend();
    }
  }

  triggerSend() {
    const value = this.text.trim();
    if (!value || this.disabled) return;
    this.send.emit(value);
    this.text = '';
    queueMicrotask(() => this.autoResize(this.ta.nativeElement));
  }

  showEmojiPicker = false;
  toggleEmojiPicker() { this.showEmojiPicker = !this.showEmojiPicker; }
  addEmojiToText(emoji: string) { this.text += emoji; }
}