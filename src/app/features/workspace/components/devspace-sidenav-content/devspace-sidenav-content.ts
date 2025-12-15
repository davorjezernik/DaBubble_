import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Subscription, debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { User } from '../../../../../models/user.class';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { SearchBusService } from '../../../../../services/search-bus.service';
import { ViewStateService } from '../../../../../services/view-state.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DmList } from './components/dm-list/dm-list';
import { ChannelList } from './components/channel-list/channel-list';
import { AuthService } from '../../../../../services/auth-service';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { UserService } from '../../../../../services/user.service';
import { ChannelService } from '../../../../../services/channel-service';
import { filter, take } from 'rxjs/operators';
import {
  MentionListComponent,
  MentionUser,
  MentionChannel,
} from '../../../../shared/components/mention-list.component/mention-list.component';

let nextDevspaceSearchId = 0;

@Component({
  selector: 'app-devspace-sidenav-content',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSidenavModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    RouterModule,
    FormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    DmList,
    ChannelList,
    MentionListComponent,
  ],
  templateUrl: './devspace-sidenav-content.html',
  styleUrls: ['./devspace-sidenav-content.scss', './devspace-sidenav-content.responsive.scss'],
})

/**
 * Sidenav content for the workspace.
 * Handles search input and passes it to DM and channel lists.
 */
export class DevspaceSidenavContent implements OnInit, OnDestroy {
  /** Cached list of users (currently not filled here but kept for future use). */
  users: User[] = [];
  private searchBusSub?: Subscription;
  /** Channels shown in the sidebar (filled by child components). */
  channels: any[] = [];

  /** UID of the currently logged-in user. */
  meUid: string | null = null;

  /** Current search string shown in the search input. */
  search = '';
  /** Reactive form control for the search field. */
  searchCtrl = new FormControl<string>('', { nonNullable: true });
  private searchCtrlSub?: Subscription;

  /** Index of the currently active item in the sidenav (if any). */
  activeIndex: number | null = null;

  private currentUserSub?: Subscription;

  devspaceSearchId = `devspace-search-${nextDevspaceSearchId++}`;

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('searchRoot') searchRoot?: ElementRef<HTMLElement>;

  showMention = false;
  mentionSearchTerm = '';
  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];
  mentionChannels: MentionChannel[] = [];

  /**
   * Creates an instance of the sidenav content component.
   * @param searchBus Service used to broadcast the current search query.
   * @param viewStateService Shared view state (e.g. max visible items).
   * @param authService Authentication service to get the current user.
   * @param router Angular router, used by the template for navigation.
   */
  constructor(
    private searchBus: SearchBusService,
    public viewStateService: ViewStateService,
    private authService: AuthService,
    private firestore: Firestore,
    private userService: UserService,
    private channelService: ChannelService,
    public router: Router
  ) {}

  /**
   * Lifecycle hook called once after component creation.
   * Sets up subscriptions to current user, search control, and search bus.
   */
  ngOnInit(): void {
    this.subscribeToCurrentUser();
    this.subscribeToSearchControl();
    this.subscribeToSearchBus();
    this.loadMentionData();
  }

  /**
   * Lifecycle hook called just before the component is destroyed.
   * Cleans up all active subscriptions.
   */
  ngOnDestroy(): void {
    this.currentUserSub?.unsubscribe();
    this.searchCtrlSub?.unsubscribe();
    this.searchBusSub?.unsubscribe();
  }

  /**
   * Subscribes to the current user stream and keeps the UID in `meUid`.
   */
  private subscribeToCurrentUser(): void {
    this.currentUserSub = this.authService.currentUser$.subscribe((user) => {
      this.meUid = user ? user.uid : null;
    });
  }

  /**
   * Opens the new DM creation view.
   * Sets the current view to 'chat' and navigates to the new DM route.
   */
  openNewDM() {
    this.viewStateService.currentView = 'chat';
    this.router.navigate(['/workspace/dm/new']);
  }

  /**
   * Subscribes to changes of the search form control.
   * Debounces and forwards the query to the search bus service.
   */
  private subscribeToSearchControl(): void {
    this.searchCtrlSub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.searchBus.set(q || ''));
  }

  /**
   * Subscribes to the shared search bus and keeps the local
   * `search` and `searchCtrl` values in sync.
   */
  private subscribeToSearchBus(): void {
    this.searchBusSub = this.searchBus.query$.subscribe((q) => {
      this.search = q;
      if (q !== this.searchCtrl.value) {
        this.searchCtrl.setValue(q, { emitEvent: false });
      }
    });
  }

  private async loadMentionData() {
    const users = await firstValueFrom(this.userService.users$());
    this.mentionUsers = users.map((u) => ({
      uid: u.uid,
      name: u.name,
      avatar: u.avatar,
      online: u.online,
    }));

    const me = await firstValueFrom(this.authService.currentUser$.pipe(filter(Boolean), take(1)));
    const allChannels = await firstValueFrom(this.channelService.getChannels());

    const myChannels = (allChannels ?? []).filter((c: any) =>
      (c?.members ?? []).some((m: any) => (typeof m === 'string' ? m : m?.uid) === me.uid)
    );

    this.mentionChannels = myChannels.map((c: any) => ({ id: c.id, name: c.name }));
  }

  onSearchInput() {
    const el = this.searchInput?.nativeElement;
    if (!el) return;

    const text = el.value ?? '';
    const pos = el.selectionStart ?? text.length;

    const wordStart = text.lastIndexOf(' ', pos - 1) + 1;
    const currentWord = text.substring(wordStart, pos);

    if (currentWord.startsWith('@')) {
      this.mentionMode = 'users';
      this.showMention = true;
      this.mentionSearchTerm = currentWord.substring(1);
    } else if (currentWord.startsWith('#')) {
      this.mentionMode = 'channels';
      this.showMention = true;
      this.mentionSearchTerm = currentWord.substring(1);
    } else {
      this.showMention = false;
      this.mentionSearchTerm = '';
    }
  }

  onSearchKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.showMention = false;
      this.mentionSearchTerm = '';
    }
  }

  insertMention(value: string) {
    const el = this.searchInput?.nativeElement;
    if (!el) return;

    const text = el.value ?? '';
    const pos = el.selectionStart ?? text.length;
    const wordStart = text.lastIndexOf(' ', pos - 1) + 1;

    const before = text.substring(0, wordStart);
    const after = text.substring(pos);

    const next = `${before}${value} ${after}`;

    this.searchCtrl.setValue(next); // bleibt kompatibel mit deinem SearchBus
    this.showMention = false;

    queueMicrotask(() => {
      const newPos = (before + value + ' ').length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  }

  private buildDmId(a: string, b: string) {
    return [a, b].sort().join('-');
  }

  async openDmFromMention(u: MentionUser) {
    const me = await firstValueFrom(this.authService.currentUser$.pipe(filter(Boolean), take(1)));
    const dmId = this.buildDmId(me.uid, u.uid);

    await setDoc(doc(this.firestore, 'dms', dmId), { members: [me.uid, u.uid] }, { merge: true });

    this.showMention = false;
    this.searchCtrl.setValue('', { emitEvent: true });
    this.viewStateService.currentView = 'chat';
    this.router.navigate(['/workspace/dm', dmId]);
  }

  openChannelFromMention(c: MentionChannel) {
    this.showMention = false;
    this.searchCtrl.setValue('', { emitEvent: true });
    this.viewStateService.currentView = 'chat';
    this.router.navigate(['/workspace/channel', c.id]);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (this.searchRoot?.nativeElement?.contains(target)) return;
    this.showMention = false;
    this.mentionSearchTerm = '';
  }
}
