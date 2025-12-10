import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
  HostListener,
  OnInit,
  AfterViewInit,
  OnDestroy,
  afterNextRender,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import { SharedComponentsModule } from '../shared-components/shared-components-module';
import { UserService } from './../../../../services/user.service';
import { ChannelService } from './../../../../services/channel-service';
import {
  MentionListComponent,
  MentionUser,
  MentionChannel,
} from '../mention-list.component/mention-list.component';
import { AuthService } from './../../../../services/auth-service';
import { NavigationEnd, Router } from '@angular/router';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { firstValueFrom, Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { User } from '@angular/fire/auth';

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
export class MessageAreaComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() disabled = false;
  @Input() maxHeight = 240;
  @Output() send = new EventEmitter<string>();
  @Input() recipientName = '';
  @Input() channelName = '';
  @Input() mode: 'channel' | 'thread' = 'channel';
  @Input() placeholder: string = '';

  @ViewChild('ta') ta!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('root') root!: ElementRef<HTMLElement>;

  text = '';
  focused = false;
  showMention = false;

  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];
  mentionChannels: MentionChannel[] = [];

  private routerSub?: Subscription;
  private pendingPrefix: '@' | '#' | null = null;

  /**
   * Build a stable DM id from two user ids (order-independent).
   * @param a First user id
   * @param b Second user id
   * @returns Combined id in the form `uidA-uidB` ordered lexicographically
   */
  private buildDmId(a: string, b: string): string {
    return [a, b].sort().join('-');
  }
  constructor(
    private usersService: UserService,
    private channelsService: ChannelService,
    private router: Router,
    private firestore: Firestore,
    private authService: AuthService,
    private injector: Injector
  ) {}

  private focusTextareaOnNavigationEnd() {
    this.routerSub?.unsubscribe();
    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.focusTextarea();
      });
  }

  /**
   * Check whether a channel member entry contains the provided uid.
   * Supports both string and object representations.
   * @param m Member entry (string uid or object with uid/userId)
   * @param uid Target user id
   */
  private memberHasUid(m: any, uid: string): boolean {
    if (typeof m === 'string') return m === uid;
    return m?.uid === uid || m?.userId === uid || m?.user?.uid === uid;
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  ngAfterViewInit(): void {
    afterNextRender(
      () => {
        this.focusTextarea();
      },
      { injector: this.injector }
    );
    this.focusTextarea();
    this.focusTextareaOnNavigationEnd();
  }

  /**
   * Initialize mention users and channels for the current context.
   * Loads all users, resolves current user, and filters channels by membership.
   */
  async ngOnInit() {
    const users = await firstValueFrom(this.usersService.users$());
    this.mentionUsers = users.map((u) => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
    }));

    const me = await firstValueFrom(
      this.authService.currentUser$.pipe(
        filter((u): u is User => !!u),
        take(1)
      )
    );
    const myUid = me.uid;

    const allChannels = await firstValueFrom(this.channelsService.getChannels());

    const myChannels = (allChannels ?? []).filter((c: any) => {
      const raw = c?.members ?? [];
      if (!Array.isArray(raw)) return false;
      return raw.some((m) => this.memberHasUid(m, myUid));
    });

    this.mentionChannels = myChannels.map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
  }

  /**
   * Handle clicks outside the message area to close mention dropdown.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.root?.nativeElement.contains(target)) return;
    if (this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
    }
  }

  /**
   * Toggle mention mode between users and channels, managing prefix insertion.
   */
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

  /**
   * Insert a mention value, replacing any pending prefix and closing dropdown.
   */
  insertMention(value: string) {
    this.replacePrefixWith(value);
    this.showMention = false;
    this.pendingPrefix = null;
  }

  /**
   * Insert text at the current cursor selection within the textarea.
   * @param insert Text to insert
   */
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

  /**
   * Handle clicks within the component box to conditionally close mention dropdown.
   */
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

  /**
   * Handle clicks inside the textarea, closing mention dropdown when open.
   */
  onTextareaClick() {
    if (this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
      this.pendingPrefix = null;
    }
  }

  /**
   * Set or swap a mention prefix at the cursor position.
   * @param prefix Prefix character ('@' or '#')
   */
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

  /**
   * Replace mention prefix at cursor with a concrete value.
   * @param value Mention replacement text
   */
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

  /**
   * Revert an automatically inserted prefix when no selection was made.
   */
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

  /**
   * Placeholder text based on mode and target recipient/channel.
   */
  get hintText(): string {
    if (this.placeholder) return this.placeholder;
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

  /**
   * Automatically resize the textarea height up to a max.
   * @param el Textarea element to resize
   */
  autoResize(el: HTMLTextAreaElement) {
    const baseHeight = 56;
    el.style.height = baseHeight + 'px';
    const next = Math.min(el.scrollHeight, this.maxHeight);
    el.style.height = next + 'px';
  }

  /**
   * Handle keydown events: send on Enter (without Shift).
   */
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

  /**
   * Handle Enter key from template binding to trigger send.
   */
  onEnter(e: KeyboardEvent) {
    if (!e.shiftKey) {
      this.triggerSend();
    }
  }

  /**
   * Emit the composed message and reset textarea.
   */
  triggerSend() {
    const value = this.text.trim();
    if (!value || this.disabled) return;
    this.send.emit(value);
    this.text = '';
    queueMicrotask(() => this.autoResize(this.ta.nativeElement));
  }

  /** Toggle emoji picker visibility. */
  showEmojiPicker = false;
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  /**
   * Append an emoji character to the message text.
   * @param emoji Emoji unicode string
   */
  addEmojiToText(emoji: string) {
    this.text += emoji;
    this.showEmojiPicker = false;
  }

  /**
   * Ensure DM exists for selected user and navigate to it.
   * @param u Mentioned user to DM
   */
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

  /**
   * Navigate to a channel selected from mention list.
   * @param c Mentioned channel
   */
  openChannelFromMention(c: MentionChannel) {
    this.showMention = false;
    this.pendingPrefix = null;
    this.router.navigate(['/workspace', 'channel', c.id]);
  }

  /** Focus the textarea element. */
  private focusTextarea() {
    const el = this.ta?.nativeElement;
    if (el) el.focus();
  }
}
