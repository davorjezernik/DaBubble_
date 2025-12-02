import { Component } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Channel, ChannelService } from '../../../../../services/channel-service';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../../../../services/auth-service';
import { BaseChatInterfaceComponent } from '../base-chat-interface-component/base-chat-interface-component';
import { CommonModule, DatePipe } from '@angular/common';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';
import { ChannelShowMembersDialog } from '../../../../shared/components/channel-show-members-dialog/channel-show-members-dialog';
import { MatDialog } from '@angular/material/dialog';
import { take, switchMap } from 'rxjs/operators';
import { EditChannel } from '../edit-channel/edit-channel';
import { map, combineLatest, Observable, of } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { ChannelMember } from '../../../../shared/components/channel-show-members-dialog/channel-show-members-dialog';
import { DialogIconAddMemberToChannel } from '../../../../shared/components/dialog-icon-add-member-to-channel/dialog-icon-add-member-to-channel';
import { AddableUser } from '../../../../shared/components/dialog-icon-add-member-to-channel/dialog-icon-add-member-to-channel';
import { ReadStateService } from '../../../../../services/read-state.service';

@Component({
  selector: 'app-channel-interface-content',
  standalone: true,
  imports: [CommonModule, MessageAreaComponent, RouterModule, DatePipe, MessageBubbleComponent],
  templateUrl: './channel-interface-content.html',
  styleUrls: ['./channel-interface-content.scss', './channel-interface-component.responsive.scss'],
})
export class ChannelInterfaceContent extends BaseChatInterfaceComponent {
  override collectionName: 'channels' | 'dms' = 'channels';
  channel$: Observable<Channel | null> = of(null);
  memberProfiles: Record<string, any> = {};
  private loadedProfileIds = new Set<string>();

  members$!: Observable<ChannelMember[]>;
  avatarPreview$!: Observable<ChannelMember[]>;
  memberCount$!: Observable<number>;

  constructor(
    protected override route: ActivatedRoute,
    protected override firestore: Firestore,
    protected override authService: AuthService,
    private channelService: ChannelService,
    private userService: UserService,
    private dialog: MatDialog,
    private read: ReadStateService
  ) {
    super(route, firestore, authService);
  }

  /**
   * Channel-specific init.
   * - Calls base init (auth, route, messages$ stream, auto-scroll).
   * - Sets up channel$ observable that auto-loads when route changes.
   * - Sets up message author profile preloading.
   */
  override ngOnInit(): void {
    super.ngOnInit();
    
    // Set up channel$ observable for async pipe
    this.channel$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      switchMap(id => id ? this.channelService.getChannel(id) : of(null))
    );
    
    // Preload message author profiles using async pattern
    this.messages$.pipe(
      map(messages => {
        const authorIds = new Set<string>();
        for (const m of messages || []) {
          if (m?.authorId && m.authorId !== this.currentUserId) {
            authorIds.add(m.authorId);
          }
        }
        return Array.from(authorIds);
      })
    ).subscribe(authorIds => {
      if (authorIds.length) {
        this.preloadMemberProfiles(authorIds);
      }
    });
  }

  /**
   * Cleanup managed by base class and async pipe.
   * No manual subscriptions to clean up.
   */
  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  /**
   * Triggered when the route chatId changes.
   * Loads member streams and marks channel as read.
   */
  override onChatIdChanged(chatId: string): void {
    // Subscribe to channel data to build member streams
    this.channel$.pipe(take(1)).subscribe({
      next: (data) => {
        this.buildMembersStreams(data?.members ?? []);
      },
      error: (err) => console.error('Error fetching channel data:', err),
    });
    
    if (this.currentUserId) {
      this.read.markChannelRead(chatId, this.currentUserId);
    } else {
      this.authService.currentUser$.pipe(take(1)).subscribe((u) => {
        if (u?.uid) this.read.markChannelRead(chatId, u.uid);
      });
    }
  }

  override async handleNewMessage(text: string) {
    if (this.chatId) this.read.bumpLastChannelMessage(this.chatId); // ⬅️ NEU: Optimistischer bump
    await super.handleNewMessage(text);
    if (this.chatId && this.currentUserId) {
      await this.read.markChannelRead(this.chatId, this.currentUserId); // ⬅️ NEU
    }
  }

  /**
   * Preload user profiles for given member IDs:
   * - Deduplicates IDs and skips already loaded ones
   * - Uses getUserData (normalizes avatar) from the base class
   * - Stores results in memberProfiles and tracks loaded IDs
   */
  private async preloadMemberProfiles(memberIds: string[]): Promise<void> {
    const unique = Array.from(new Set(memberIds)).filter(Boolean);
    for (const uid of unique) {
      if (!this.memberProfiles[uid] && !this.loadedProfileIds.has(uid)) {
        try {
          const profile = await this.getUserData(uid);
          if (profile) {
            this.memberProfiles[uid] = profile;
            this.loadedProfileIds.add(uid);
          }
        } catch (e) {}
      }
    }
  }

  private normalizeMembers(members: Array<string | { uid?: string; displayName?: string }>) {
    return (members || []).map((m) => (typeof m === 'string' ? { uid: m } : m ?? { uid: '' }));
  }

  private getUids(entries: Array<{ uid?: string }>) {
    return entries.map((e) => e.uid).filter(Boolean) as string[];
  }

  private prioritizeCurrentUser(uids: string[]) {
    if (this.currentUserId) {
      const myIndex = uids.indexOf(this.currentUserId);
      if (myIndex !== -1) {
        uids.splice(myIndex, 1);
        uids.unshift(this.currentUserId);
      }
    }
    return uids;
  }

  private createProfileStreamFactory(entries: Array<{ uid?: string; displayName?: string }>) {
    return (uid: string) =>
      this.userService.userById$(uid).pipe(
        map((u) => ({
          id: uid,
          name: u?.name ?? entries.find((e) => e.uid === uid)?.displayName ?? 'Unbekannt',
          avatar: u?.avatar ?? 'assets/img-profile/profile.png',
          online: !!u?.online,
        }))
      );
  }

  private buildAvatarPreview$(uids: string[], createProfile: (uid: string) => Observable<any>) {
    const previewUids = uids.slice(0, 3);
    const previewStreams = previewUids.map(createProfile);
    return previewStreams.length ? combineLatest(previewStreams) : of([]);
  }

  private buildMembers$(uids: string[], createProfile: (uid: string) => Observable<any>) {
    if (!uids.length) return of([]);
    const allProfileStreams = uids.map(createProfile);
    return combineLatest(allProfileStreams).pipe(
      map((list) =>
        list.sort((a, b) =>
          a.id === this.currentUserId ? -1 : b.id === this.currentUserId ? 1 : 0
        )
      )
    );
  }

  assignMemberStreams(uids: string[], createProfile: (uid: string) => Observable<any>) {
    if (!uids.length) {
      this.members$ = of([]);
      this.avatarPreview$ = of([]);
      return;
    }
    this.avatarPreview$ = this.buildAvatarPreview$(uids, createProfile);
    this.members$ = this.buildMembers$(uids, createProfile);
  }

  private buildMembersStreams(
    members: Array<string | { uid?: string; displayName?: string }> = []
  ) {
    const entries = this.normalizeMembers(members);
    let uids = this.getUids(entries);

    uids = this.prioritizeCurrentUser(uids);
    this.memberCount$ = of(uids.length);

    const createProfileStream = this.createProfileStreamFactory(entries);
    this.assignMemberStreams(uids, createProfileStream);
  }

  onAddUserClick(ev: MouseEvent, anchor: HTMLElement) {
    ev.stopPropagation();
    if (window.innerWidth <= 950) {
      this.openMembersDialog(ev, anchor);
      return;
    }
    this.openAddMembersUnderIcon(ev, anchor);
  }

  // open ChannelShowMembersDialog //
  openMembersDialog(ev?: MouseEvent, anchor?: HTMLElement) {
    ev?.stopPropagation();

    const el = anchor ?? (ev?.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();

    const GAP = 5;
    const DLG_W = 450;
    const top = rect.bottom + window.scrollY + GAP;
    const left = Math.max(8, rect.right + window.scrollX - DLG_W);

    const ref = this.dialog.open(ChannelShowMembersDialog, {
      autoFocus: false,
      hasBackdrop: true,
      panelClass: 'members-dialog-panel',
      position: { top: `${top}px`, left: `${left}px` },
    });

    const sub = this.members$.subscribe((ms) => {
      ref.componentInstance.members = ms;
      ref.componentInstance.currentUserId = this.currentUserId ?? '';
      
      // Get current channel name from observable
      this.channel$.pipe(take(1)).subscribe(channel => {
        ref.componentInstance.channelName = channel?.name ?? '';
      });
      
      ref.componentInstance.addIconAnchor = anchor ?? null;
      sub.unsubscribe();
    });

    ref.afterClosed().pipe(take(1)).subscribe(() => { sub.unsubscribe()});

    ref.componentInstance.close.subscribe(() => ref.close());
    ref.componentInstance.addMembersClick.subscribe(({ ev, anchor }) => {
      this.openAddMembersUnderIcon(ev, anchor ?? el);
    });
  }

  // open dialog-icon-add-member-to-channel //
  openAddMembersUnderIcon(ev: MouseEvent, anchor: HTMLElement) {
    ev.stopPropagation();

    const rect = anchor.getBoundingClientRect();
    const GAP = 5;
    const DLG_W = 480;

    // Get current channel data
    this.channel$.pipe(take(1)).subscribe(channelData => {
      const memberUids = (channelData?.members ?? [])
        .map((m: any) => (typeof m === 'string' ? m : m.uid))
        .filter((x: any) => !!x);

      this.userService
        .users$()
        .pipe(take(1))
        .subscribe((allUsers) => {
          const candidates: AddableUser[] = allUsers
            .filter((u) => !memberUids.includes(u.uid))
            .map((u) => ({
              uid: u.uid,
              name: u.name,
              avatar: u.avatar,
              online: u.online,
            }));

          const top = rect.bottom + window.scrollY + GAP;
          const left = Math.max(8, rect.right + window.scrollX - DLG_W);

          const ref = this.dialog.open(DialogIconAddMemberToChannel, {
            panelClass: 'add-members-dialog-panel',
            hasBackdrop: true,
            autoFocus: false,
            restoreFocus: true,
            width: `${DLG_W}px`,
            position: { top: `${top}px`, left: `${left}px` },
          });

          ref.componentInstance.channelName = channelData?.name ?? '';
          ref.componentInstance.candidates = candidates;

          ref.componentInstance.add.subscribe((users: AddableUser[]) => {
            if (!channelData?.id) {
              console.warn('keine channel id');
              ref.close();
              return;
            }

            this.channelService
              .addMembersToChannel(channelData.id, users)
              .catch((err) => console.error(err))
              .finally(() => ref.close());
          });

          ref.componentInstance.close.subscribe(() => ref.close());
        });
    });
  }

  // Öffnet EditChannel als Modal
  openEditChannel(ev?: MouseEvent) {
    ev?.stopPropagation();
    
    this.channel$.pipe(take(1)).subscribe(channelData => {
      if (channelData?.name === 'everyone') {
        return;
      }
      if (!channelData) return;
      
      const ref = this.dialog.open(EditChannel, {
        data: { channel: channelData },
        autoFocus: false,
      });
      ref
        .afterClosed()
        .pipe(take(1))
        .subscribe((res) => {});
    });
  }
}
