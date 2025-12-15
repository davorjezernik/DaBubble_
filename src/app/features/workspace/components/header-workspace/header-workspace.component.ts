import {
  Component,
  EventEmitter,
  Output,
  OnDestroy,
  OnInit,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subscription, Observable, firstValueFrom } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DialogUserCardComponent } from '../../../../shared/components/dialog-user-card/dialog-user-card.component';
import { UserMenuDialogComponent } from '../../../../shared/components/user-menu-dialog.component/user-menu-dialog.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { SearchBusService } from '../../../../../services/search-bus.service';
import { UserMenuService } from '../../../../../services/user-menu.service';
import { ViewStateService } from '../../../../../services/view-state.service';
import { AuthService } from '../../../../../services/auth-service';
import { ElementRef, ViewChild } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { ChannelService } from '../../../../../services/channel-service';
import {
  MentionChannel,
  MentionUser,
} from '../../../../shared/components/mention-list.component/mention-list.component';
import { filter, take } from 'rxjs/operators';
import { MentionListComponent } from '../../../../shared/components/mention-list.component/mention-list.component';

@Component({
  selector: 'app-header-workspace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDialogModule,
    MentionListComponent,
  ],
  templateUrl: './header-workspace.component.html',
  styleUrls: ['./header-workspace.component.scss', './header-workspace-component.responsive.scss'],
})
@HostListener('window:beforeunload')
export class HeaderWorkspaceComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private dialog = inject(MatDialog);
  private bottomSheet = inject(MatBottomSheet);
  private searchBus = inject(SearchBusService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private channelService = inject(ChannelService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchRoot') searchRoot!: ElementRef<HTMLElement>;

  showMention = false;
  mentionSearchTerm = '';
  mentionMode: 'users' | 'channels' = 'users';
  mentionUsers: MentionUser[] = [];
  mentionChannels: MentionChannel[] = [];
  private pendingPrefix: '@' | '#' | null = null;

  private buildDmId(a: string, b: string) {
    return [a, b].sort().join('-');
  }

  user$: Observable<User | null> = this.userService.currentUser$();

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  private sub?: Subscription;
  @Output() searchChange = new EventEmitter<string>();

  constructor(public userMenuService: UserMenuService, public viewStateService: ViewStateService) {
    this.sub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => {
        const v = (q ?? '').trim();
        this.searchChange.emit(v);
        this.searchBus.set(v);
      });
  }

  /**
   * Lifecycle hook: marks the current user online when the header loads.
   */
  async ngOnInit() {
    await this.userService.markOnline(true);
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
      this.pendingPrefix = '@';
    } else if (currentWord.startsWith('#')) {
      this.mentionMode = 'channels';
      this.showMention = true;
      this.mentionSearchTerm = currentWord.substring(1);
      this.pendingPrefix = '#';
    } else {
      this.showMention = false;
      this.pendingPrefix = null;
    }
  }

  insertMention(value: string) {
    const el = this.searchInput.nativeElement;
    const text = el.value ?? '';
    const pos = el.selectionStart ?? text.length;

    const wordStart = text.lastIndexOf(' ', pos - 1) + 1;

    const before = text.substring(0, wordStart);
    const after = text.substring(pos);

    const next = `${before}${value} ${after}`; // space nach mention

    this.searchCtrl.setValue(next); // triggert deine bestehende searchBus-Logik
    this.showMention = false;
    this.pendingPrefix = null;

    queueMicrotask(() => {
      const newPos = (before + value + ' ').length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  }

  async openDmFromMention(u: MentionUser) {
    const me = await firstValueFrom(this.authService.currentUser$.pipe(filter(Boolean), take(1)));
    const dmId = this.buildDmId(me.uid, u.uid);

    await setDoc(doc(this.firestore, 'dms', dmId), { members: [me.uid, u.uid] }, { merge: true });

    this.showMention = false;
    this.searchCtrl.setValue('', { emitEvent: true });
    this.router.navigate(['/workspace/dm', dmId]);
  }

  openChannelFromMention(c: MentionChannel) {
    this.showMention = false;
    this.searchCtrl.setValue('', { emitEvent: true });
    this.router.navigate(['/workspace/channel', c.id]);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (this.searchRoot?.nativeElement.contains(target)) return;
    this.showMention = false;
    this.pendingPrefix = null;
  }

  onSearchKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.showMention) {
      this.showMention = false;
      this.pendingPrefix = null;
    }
  }

  /**
   * Lifecycle hook: unsubscribes listeners and marks user offline (if not anonymous).
   */
  ngOnDestroy() {
    this.sub?.unsubscribe();

    this.authService.currentUser$.pipe(take(1)).subscribe((user) => {
      if (user && !user.isAnonymous) {
        this.userService.markOnline(false);
      }
    });
  }

  /**
   * Opens the user menu. Uses mobile bottom sheet for small screens,
   * otherwise opens a positioned desktop dialog.
   *
   * @param evt - Mouse click event from the trigger.
   */
  openUserMenu(evt: MouseEvent) {
    const { r, GAP, MARGIN, MENU_W } = this.getAvatarDialogDistance(evt);

    if (window.innerWidth <= 400) return this.openMobileMenuDialog();

    const { left, top } = this.defineMenuDialogPosition(r, GAP, MARGIN, MENU_W);

    const ref = this.openDesktopMenuDialog(left, top);
    this.closeDesktopMenuDialog(ref);
  }

  /**
   * Opens the desktop version of the user menu dialog.
   *
   * @param left - Left position offset.
   * @param top - Top position offset.
   * @returns Dialog reference.
   */
  private openDesktopMenuDialog(left: number, top: number) {
    return this.dialog.open(UserMenuDialogComponent, {
      data: {},
      panelClass: 'user-menu-dialog',
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: true,
      position: { top: `${top}px`, left: `${left}px` },
    });
  }

  /**
   * Subscribes to the dialog close event to perform actions.
   *
   * @param ref - Dialog reference of the opened user menu.
   */
  private closeDesktopMenuDialog(ref: any) {
    ref
      .afterClosed()
      .pipe(take(1))
      .subscribe((action: 'profile' | 'logout' | undefined) => {
        if (action === 'profile') this.openProfil();
        if (action === 'logout') this.logout();
      });
  }

  /**
   * Calculates dialog position within screen bounds from the avatar rect.
   *
   * @param r - Bounding rectangle of the avatar element.
   * @param GAP - Gap from the trigger element.
   * @param MARGIN - Screen margin.
   * @param MENU_W - Menu width.
   * @returns Calculated left/top coordinates.
   */
  private defineMenuDialogPosition(r: DOMRect, GAP: number, MARGIN: number, MENU_W: number) {
    let left = r.right - MENU_W;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - MENU_W - MARGIN));
    const top = r.bottom + GAP;
    return { left, top };
  }

  /**
   * Opens the mobile bottom sheet variant of the user menu.
   */
  private openMobileMenuDialog() {
    const ref = this.bottomSheet.open(UserMenuDialogComponent, {
      data: {},
      panelClass: 'user-menu-bottom',
    });
    ref
      .afterDismissed()
      .pipe(take(1))
      .subscribe((action: 'profile' | 'logout' | undefined) => {
        if (action === 'profile') this.openProfil();
        if (action === 'logout') this.logout();
      });
  }

  /**
   * Computes geometry needed to position the menu relative to the avatar.
   *
   * @param evt - Mouse event from the trigger element.
   * @returns Avatar rect and positioning constants.
   */
  private getAvatarDialogDistance(evt: MouseEvent) {
    const trigger = evt.currentTarget as HTMLElement;
    const avatar = (trigger.querySelector('.avatar-wrap') as HTMLElement) ?? trigger;
    const r = avatar.getBoundingClientRect();
    const GAP = 8;
    const MARGIN = 16;
    const MENU_W = window.innerWidth <= 880 ? 350 : 300;
    return { r, GAP, MARGIN, MENU_W };
  }

  /**
   * Opens the profile dialog for the current user.
   */
  openProfil() {
    this.user$.pipe(take(1)).subscribe((user) => {
      if (!user) return;
      this.dialog.open(DialogUserCardComponent, {
        data: { user },
        panelClass: 'user-card-dialog',
        width: '90vw',
        maxWidth: '500px',
        maxHeight: '90vh',
        autoFocus: false,
        restoreFocus: true,
      });
    });
  }

  /**
   * Logs the user out, ensures online status is updated, and navigates home.
   */
  async logout() {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (user) {
      await this.userService.markOnline(false);
    }

    await this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
