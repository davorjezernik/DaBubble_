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
import { take } from 'rxjs/operators';
import { EditChannel } from '../edit-channel/edit-channel';
import { map, combineLatest, Observable, of, Subscription } from 'rxjs';
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
  channelData: Channel | null = null;
  memberProfiles: Record<string, any> = {};
  private loadedProfileIds = new Set<string>();
  private localMessagesSub?: Subscription;
  private channelSub?: Subscription;

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
   * - Subscribes to messages$ to collect authorIds and preload their profiles,
   *   so incoming avatars render even if authors aren't listed in channelData.members.
   */
  override ngOnInit(): void {
    super.ngOnInit();
    this.subscribeToLocalMessages();
  }

  /**
   * Cleanup for the local messages subscription.
   * The base hook disposes route/auth/messages subscriptions; here we dispose
   * the additional subscription used for author profile preloading.
   */
  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.localMessagesSub?.unsubscribe();
    this.channelSub?.unsubscribe();
  }

  /**
   * Subscribes to the local `messages$` stream and builds a preload list
   * of author profiles so avatars are available immediately.
   */
  private subscribeToLocalMessages() {
    this.localMessagesSub = this.messages$.subscribe((messages) =>
      this.buildAuthorPreloadList(messages)
    );
  }

  /**
   * Builds a unique list of author IDs from incoming messages and triggers
   * profile preloading for those authors.
   *
   * @param messages - Array of chat message objects.
   */
  private buildAuthorPreloadList(messages: any[]) {
    const authorIds = new Set<string>();
    for (const m of messages || []) {
      if (m?.authorId && m.authorId !== this.currentUserId) {
        authorIds.add(m.authorId);
      }
    }
    if (authorIds.size) {
      this.preloadMemberProfiles(Array.from(authorIds));
    }
  }

  /**
   * Triggered when the route chatId changes.
   * Loads channel metadata and preloads member profiles so names/avatars are ready.
   */
  override onChatIdChanged(chatId: string): void {
    this.channelSub?.unsubscribe();
    this.subscribeToChannel(chatId);
    this.markAsRead(chatId);
  }

  /**
   * Marks the given channel as read for the current user.
   * Falls back to `authService.currentUser$` if `currentUserId` is not yet set.
   *
   * @param chatId - Channel ID to mark as read.
   */
  private markAsRead(chatId: string) {
    if (this.currentUserId) {
      this.read.markChannelRead(chatId, this.currentUserId);
    } else {
      this.authService.currentUser$.pipe(take(1)).subscribe((u) => {
        if (u?.uid) this.read.markChannelRead(chatId, u.uid);
      });
    }
  }

  /**
   * Subscribes to channel metadata by ID and updates member-related streams.
   *
   * @param chatId - Channel ID to subscribe to.
   */
  private subscribeToChannel(chatId: string) {
    this.channelSub = this.channelService.getChannel(chatId).subscribe({
      next: (data) => {
        this.channelData = data;
        this.buildMembersStreams(data?.members ?? []);
      },
      error: (err) => console.error('Error fetching channel data:', err),
    });
  }

  /**
   * Sends a new message and updates read state accordingly.
   *
   * @param text - The message text content.
   * @returns Promise resolved when message handling finishes.
   */
  override async handleNewMessage(text: string) {
    if (this.chatId) this.read.bumpLastChannelMessage(this.chatId);
    await super.handleNewMessage(text);
    if (this.chatId && this.currentUserId) {
      await this.read.markChannelRead(this.chatId, this.currentUserId);
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
      await this.getMemberProfile(uid);
    }
  }

  /**
   * Ensures a member profile is loaded and cached locally.
   *
   * @param uid - User ID to load the profile for.
   * @returns Promise resolved when retrieval attempt completes.
   */
  private async getMemberProfile(uid: string) {
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

  /**
   * Normalizes a mixed list of member representations into objects.
   *
   * @param members - Array of string UIDs or objects with `uid` and optional `displayName`.
   * @returns Normalized array of objects with `uid`.
   */
  private normalizeMembers(members: Array<string | { uid?: string; displayName?: string }>) {
    return (members || []).map((m) => (typeof m === 'string' ? { uid: m } : m ?? { uid: '' }));
  }

  /**
   * Extracts UIDs from normalized member entries.
   *
   * @param entries - Array of member objects possibly containing `uid`.
   * @returns Array of defined user IDs.
   */
  private getUids(entries: Array<{ uid?: string }>) {
    return entries.map((e) => e.uid).filter(Boolean) as string[];
  }

  /**
   * Moves the current user's UID to the front of the list.
   *
   * @param uids - List of user IDs.
   * @returns Reordered list prioritizing current user.
   */
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

  /**
   * Creates a factory that maps a UID to a user profile observable.
   *
   * @param entries - Normalized member entries used to fall back to `displayName`.
   * @returns Function that returns an observable with profile info for a given UID.
   */
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

  /**
   * Builds an avatar preview observable for up to the first 3 members.
   *
   * @param uids - All member UIDs.
   * @param createProfile - Factory producing profile observables for a UID.
   * @returns Observable of preview profiles array.
   */
  private buildAvatarPreview$(uids: string[], createProfile: (uid: string) => Observable<any>) {
    const previewUids = uids.slice(0, 3);
    const previewStreams = previewUids.map(createProfile);
    return previewStreams.length ? combineLatest(previewStreams) : of([]);
  }

  /**
   * Builds the members list observable containing all profiles and sorts
   * the current user to the front.
   *
   * @param uids - All member UIDs.
   * @param createProfile - Factory producing profile observables for a UID.
   * @returns Observable emitting the sorted full members list.
   */
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

  /**
   * Assigns the `members$` and `avatarPreview$` streams using provided UIDs
   * and profile stream factory.
   *
   * @param uids - Member identifiers.
   * @param createProfile - Factory for profile observables per UID.
   */
  assignMemberStreams(uids: string[], createProfile: (uid: string) => Observable<any>) {
    if (!uids.length) {
      this.members$ = of([]);
      this.avatarPreview$ = of([]);
      return;
    }
    this.avatarPreview$ = this.buildAvatarPreview$(uids, createProfile);
    this.members$ = this.buildMembers$(uids, createProfile);
  }

  /**
   * Builds all member-related streams for the channel and sets the member count.
   *
   * @param members - Raw member list as strings or objects.
   */
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

  /**
   * Click handler to either open the members dialog or the inline
   * add-members dialog depending on viewport width.
   *
   * @param ev - Mouse event from the click.
   * @param anchor - Anchor element for dialog positioning.
   */
  onAddUserClick(ev: MouseEvent, anchor: HTMLElement) {
    ev.stopPropagation();
    if (window.innerWidth <= 950) {
      this.openMembersDialog(ev, anchor);
      return;
    }
    this.openAddMembersUnderIcon(ev, anchor);
  }

  /**
   * Opens the members dialog positioned near the given anchor.
   *
   * @param ev - Optional mouse event to stop propagation.
   * @param anchor - Optional element for positioning.
   */
  openMembersDialog(ev?: MouseEvent, anchor?: HTMLElement) {
    ev?.stopPropagation();

    const { top, left, el } = this.getDialogPosition(anchor, ev);
    const ref = this.openMembersDialogAt(top, left);
    const sub = this.setInitialDialogData(ref, anchor);

    this.unsubscribeMembersDialogOnClose(sub, ref);

    this.registerMembersDialog(ref, el);
  }

  /**
   * Wires dialog outputs for closing and opening the add-members dialog.
   *
   * @param ref - Dialog reference instance.
   * @param el - Anchor element for the add-members dialog.
   */
  private registerMembersDialog(ref: any, el: HTMLElement) {
    ref.componentInstance.close.subscribe(() => ref.close());
    ref.componentInstance.addMembersClick.subscribe(
      ({ ev, anchor }: { ev: any; anchor: HTMLElement }) => {
        this.openAddMembersUnderIcon(ev, anchor ?? el);
      }
    );
  }

  /**
   * Opens the members dialog at fixed coordinates.
   *
   * @param top - Top offset in pixels.
   * @param left - Left offset in pixels.
   * @returns Material dialog reference.
   */
  private openMembersDialogAt(top: number, left: number) {
    return this.dialog.open(ChannelShowMembersDialog, {
      autoFocus: false,
      hasBackdrop: true,
      panelClass: 'members-dialog-panel',
      position: { top: `${top}px`, left: `${left}px` },
    });
  }

  /**
   * Computes dialog position from an anchor element or event target.
   *
   * @param anchor - Element to anchor the dialog to.
   * @param ev - Optional mouse event to derive target.
   * @returns Position values and the resolved anchor element.
   */
  private getDialogPosition(anchor?: HTMLElement | null, ev?: MouseEvent) {
    const el = anchor ?? (ev?.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();

    const GAP = 5;
    const DLG_W = 450;
    const top = rect.bottom + window.scrollY + GAP;
    const left = Math.max(8, rect.right + window.scrollX - DLG_W);
    return { top, left, el };
  }

  /**
   * Unsubscribes the provided subscription once the dialog is closed.
   *
   * @param sub - Subscription to dispose.
   * @param ref - Dialog reference to observe.
   */
  private unsubscribeMembersDialogOnClose(sub: Subscription, ref: any) {
    ref
      .afterClosed()
      .pipe(take(1))
      .subscribe(() => {
        sub.unsubscribe();
      });
  }

  /**
   * Sets initial data on the members dialog and returns the temporary
   * subscription used for seeding.
   *
   * @param ref - Dialog reference.
   * @param anchor - Optional anchor element for add-icon positioning.
   * @returns Subscription that is immediately unsubscribed after first emit.
   */
  private setInitialDialogData(ref: any, anchor?: HTMLElement | null) {
    const sub = this.members$.pipe(take(1)).subscribe((ms) => {
      ref.componentInstance.members = ms;
      ref.componentInstance.currentUserId = this.currentUserId ?? '';
      ref.componentInstance.channelName = this.channelData?.name ?? '';
      ref.componentInstance.addIconAnchor = anchor ?? null;
    });
    return sub;
  }

  /**
   * Opens the inline add-members dialog positioned under the given icon.
   *
   * @param ev - Mouse event to stop propagation.
   * @param anchor - Element used to compute dialog position.
   */
  openAddMembersUnderIcon(ev: MouseEvent, anchor: HTMLElement) {
    ev.stopPropagation();

    const { rect, GAP, DLG_W } = this.setAddMembersDialogMeasures(anchor);
    const memberUids = this.getMemberUids();

    this.userService
      .users$()
      .pipe(take(1))
      .subscribe((allUsers) => {
        const candidates: AddableUser[] = this.getCandidatesWithData(allUsers, memberUids);
        const { top, left } = this.defineAddMembersDialogPosition(rect, GAP, DLG_W);
        const ref = this.openDialogIconAddMemberToChannel(left, top, DLG_W);

        this.attachModalInputs(ref, candidates);
        this.attachModalOutputs(ref);
      });
  }

  /**
   * Wires add and close outputs for the add-members dialog.
   *
   * @param ref - Dialog reference instance.
   */
  private attachModalOutputs(ref: any) {
    ref.componentInstance.add.subscribe((users: AddableUser[]) => {
      if (!this.channelData?.id) {
        ref.close();
        return;
      }

      this.channelService
        .addMembersToChannel(this.channelData.id, users)
        .catch((err) => console.error(err))
        .finally(() => ref.close());
    });

    ref.componentInstance.close.subscribe(() => ref.close());
  }

  /**
   * Seeds the add-members dialog with initial inputs.
   *
   * @param ref - Dialog reference.
   * @param candidates - List of users available to add.
   */
  private attachModalInputs(ref: any, candidates: AddableUser[]) {
    ref.componentInstance.channelName = this.channelData?.name ?? '';
    ref.componentInstance.candidates = candidates;
  }

  /**
   * Opens the add-members dialog component with explicit position and width.
   *
   * @param left - Left offset in pixels.
   * @param top - Top offset in pixels.
   * @param DLG_W - Dialog width in pixels.
   * @returns Dialog reference.
   */
  private openDialogIconAddMemberToChannel(left: number, top: number, DLG_W: number) {
    return this.dialog.open(DialogIconAddMemberToChannel, {
      panelClass: 'add-members-dialog-panel',
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: true,
      width: `${DLG_W}px`,
      position: { top: `${top}px`, left: `${left}px` },
    });
  }

  /**
   * Computes the position for the add-members dialog based on the anchor rect.
   *
   * @param rect - Bounding client rect of the anchor element.
   * @param GAP - Gap between anchor and dialog.
   * @param DLG_W - Dialog width.
   * @returns Calculated top and left offsets.
   */
  private defineAddMembersDialogPosition(rect: any, GAP: number, DLG_W: number) {
    const top = rect.bottom + window.scrollY + GAP;
    const left = Math.max(8, rect.right + window.scrollX - DLG_W);
    return { top, left };
  }

  /**
   * Builds a list of candidate users (not yet members) and maps to dialog input shape.
   *
   * @param allUsers - Complete list of users from the service.
   * @param memberUids - Current channel member UIDs.
   * @returns Candidate user list suitable for the dialog.
   */
  private getCandidatesWithData(allUsers: any[], memberUids: string[]) {
    const candidates: AddableUser[] = allUsers
      .filter((u) => !memberUids.includes(u.uid))
      .map((u) => ({
        uid: u.uid,
        name: u.name,
        avatar: u.avatar,
        online: u.online,
      }));
    return candidates;
  }

  /**
   * Retrieves all member UIDs from the channel data regardless of representation.
   *
   * @returns Array of member user IDs.
   */
  private getMemberUids() {
    return (this.channelData?.members ?? [])
      .map((m: any) => (typeof m === 'string' ? m : m.uid))
      .filter((x: any) => !!x);
  }

  /**
   * Measures and returns geometry values for positioning the add-members dialog.
   *
   * @param anchor - Element used as reference.
   * @returns Object containing rect, gap, and dialog width.
   */
  private setAddMembersDialogMeasures(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const GAP = 5;
    const DLG_W = 480;
    return { rect, GAP, DLG_W };
  }

  /**
   * Opens the edit-channel dialog unless the channel is the "everyone" channel.
   *
   * @param ev - Optional mouse event to stop propagation.
   */
  openEditChannel(ev?: MouseEvent) {
    ev?.stopPropagation();
    if (this.channelData?.name === 'everyone' || !this.channelData) return;
    this.dialog.open(EditChannel, {
      data: { channel: this.channelData },
      autoFocus: false,
    });
  }
}
