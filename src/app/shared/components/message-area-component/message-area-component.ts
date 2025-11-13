import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import { SharedComponentsModule } from '../shared-components/shared-components-module';
import { UserService } from './../../../../services/user.service';
import { ChannelService } from './../../../../services/channel.service';
import { firstValueFrom } from 'rxjs';
import {
  MentionListComponent,
  MentionUser,
  MentionChannel,
} from '../mention-list.component/mention-list.component';
import { AuthService } from './../../../../services/auth-service';
import { Router } from '@angular/router';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-message-area-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmojiPickerComponent,
    SharedComponentsModule,
    MentionListComponent,
  ],
  templateUrl: './message-area-component.html',
  styleUrl: './message-area-component.scss',
})
export class MessageAreaComponent {
  @Input() disabled = false;
  @Input() maxHeight = 240;
  @Output() send = new EventEmitter<string>();
  @Input() recipientName = '';
  @Input() channelName = '';
  @Input() mode: 'channel' | 'thread' = 'channel';

  @ViewChild('ta') ta!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('root') root!: ElementRef<HTMLElement>;

  text = '';
  focused = false;
  showMention = false;

  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];
  mentionChannels: MentionChannel[] = [];

  private pendingPrefix: '@' | '#' | null = null;

  private buildDmId(a: string, b: string): string {
    return [a, b].sort().join('-');
  }
  constructor(
    private usersService: UserService,
    private channelsService: ChannelService,
    private router: Router,
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  // Daten für mention laden //
  async ngOnInit() {
    const users = await firstValueFrom(this.usersService.users$());
    this.mentionUsers = users.map((u) => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
    }));

    const channels = await firstValueFrom(this.channelsService.channels$());
    this.mentionChannels = channels;
  }

  // Klick außerhalb der Message-Area //
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.root?.nativeElement.contains(target)) return;
    if (this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
    }
  }

  // Wechselt der @ taste //
  toggleMentionMode() {
    if (!this.showMention) {
      this.mentionMode = 'users';
      this.showMention = true;
      this.setOrSwapPrefix('@');
      this.pendingPrefix = '@';
      return;
    }
    if (this.mentionMode === 'users') {
      this.mentionMode = 'channels';
      this.setOrSwapPrefix('#');
      this.pendingPrefix = '#';
    } else {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
      this.pendingPrefix = null;
    }
  }

  // Fügt eine mention ein //
  insertMention(value: string) {
    this.replacePrefixWith(value);
    this.showMention = false;
    this.pendingPrefix = null;
  }

  // Fügt den Text an der Cursor-Position ein //
  private insertAtCursor(insert: string) {
    const el = this.ta?.nativeElement;
    if (!el) {
      this.text += insert;
      return;
    }

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

  // Klick außerhalb der Message-Area //
  onBoxClick(ev: MouseEvent) {
    if (!this.showMention) return;

    const target = ev.target as HTMLElement;
    if (
      target.closest('.icon-btn') ||
      target.closest('app-emoji-picker-component') ||
      target.closest('app-mention-list')
    ) {
      return;
    }

    this.showMention = false;
    this.revertPendingPrefixIfAny();
    this.pendingPrefix = null;
  }

  // Klick im Textbereich //
  onTextareaClick() {
    if (this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
      this.pendingPrefix = null;
    }
  }

  // Setzt oder tauscht das Präfix aus //
  private setOrSwapPrefix(prefix: '@' | '#') {
    const el = this.ta?.nativeElement;
    if (!el) {
      this.text += prefix;
      return;
    }
    let pos = el.selectionStart ?? this.text.length;
    if (pos > 0 && (this.text[pos - 1] === '@' || this.text[pos - 1] === '#')) {
      this.text = this.text.slice(0, pos - 1) + prefix + this.text.slice(pos);
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
        this.autoResize(el);
      });
      return;
    }
    const needsSpace = pos > 0 && /\S/.test(this.text[pos - 1]);
    const insert = (needsSpace ? ' ' : '') + prefix;
    this.insertAtCursor(insert);
  }

  // Ersetzt das Präfix mit dem angegebenen Wert //
  private replacePrefixWith(value: string) {
    const el = this.ta?.nativeElement;
    if (!el) {
      this.text += value;
      return;
    }
    const start = el.selectionStart ?? this.text.length;
    const end = el.selectionEnd ?? this.text.length;

    let from = start,
      to = end;
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

  // Entfernt ein automatisch gesetztes Präfix, wenn keine Auswahl erfolgte //
  private revertPendingPrefixIfAny() {
    if (!this.pendingPrefix) return;

    const el = this.ta?.nativeElement;
    if (!el) {
      this.pendingPrefix = null;
      return;
    }
    const pos = el.selectionStart ?? this.text.length;
    const prev = pos > 0 ? this.text[pos - 1] : '';
    if (prev === this.pendingPrefix) {
      const before = this.text.slice(0, pos - 1);
      const after = this.text.slice(pos);

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

  // Text anzeige placeholder //
  get hintText(): string {
    if (this.mode === 'thread') return 'Antworten';

    const target = this.recipientName?.trim()
      ? `${this.recipientName.trim()}`
      : this.channelName?.trim()
      ? this.channelName.trim().startsWith('#')
        ? this.channelName.trim()
        : `#${this.channelName.trim()}`
      : '#Team';

    return `Nachricht an ${target}`;
  }

  // Automatische Größenanpassung der Textarea //
  autoResize(el: HTMLTextAreaElement) {
    const baseHeight = 56;
    el.style.height = baseHeight + 'px';
    const next = Math.min(el.scrollHeight, this.maxHeight);
    el.style.height = next + 'px';
  }

  // Tastendruck im Textbereich //
  onKeyDown(e: KeyboardEvent) {
    if (
      (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) &&
      !e.shiftKey &&
      !e.isComposing
    ) {
      e.preventDefault();
      this.triggerSend();
    }
  }

  // Enter-Taste im Textbereich //
  onEnter(e: KeyboardEvent) {
    if (!e.shiftKey) {
      this.triggerSend();
    }
  }

  // Sendet die Nachricht //
  triggerSend() {
    const value = this.text.trim();
    if (!value || this.disabled) return;
    this.send.emit(value);
    this.text = '';
    queueMicrotask(() => this.autoResize(this.ta.nativeElement));
  }

  // Emoji Picker //
  showEmojiPicker = false;
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  // Fügt ein Emoji in den Textbereich ein //
  addEmojiToText(emoji: string) {
    this.text += emoji;
  }

  // Öffnet einen DM-Kanal von der Mention-Liste //
  async openDmFromMention(u: MentionUser) {
    try {
      const me: any = await firstValueFrom(this.authService.currentUser$);
      if (!me) return;
      const dmId = this.buildDmId(me.uid, u.uid);

      await setDoc(doc(this.firestore, 'dms', dmId), { members: [me.uid, u.uid] }, { merge: true });

      this.showMention = false;
      this.pendingPrefix = null;
      this.router.navigate(['/workspace', 'dm', dmId]);
    } catch (e) {
      console.error('openDmFromMention failed', e);
    }
  }

  // Öffnet einen Channel von der Mention-Liste //
  openChannelFromMention(c: MentionChannel) {
    this.showMention = false;
    this.pendingPrefix = null;
    this.router.navigate(['/workspace', 'channel', c.id]);
  }
}
