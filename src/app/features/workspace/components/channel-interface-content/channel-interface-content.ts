import { Component } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Channel, ChannelService } from '../../../../../services/channel-service';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../../../../services/auth-service';
import { BaseChatInterfaceComponent } from '../base-chat-interface-component/base-chat-interface-component';
import { CommonModule, DatePipe } from '@angular/common';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';

@Component({
  selector: 'app-channel-interface-content',
  standalone: true,
  imports: [
    CommonModule,
    MessageAreaComponent,
    RouterModule,
    DatePipe,
    MessageBubbleComponent,
  ],
  templateUrl: './channel-interface-content.html',
  styleUrl: './channel-interface-content.scss',
})
export class ChannelInterfaceContent extends BaseChatInterfaceComponent {
  override collectionName: 'channels' | 'dms' = 'channels';
  channelData: Channel | null = null;
  memberProfiles: Record<string, any> = {};
  private loadedProfileIds = new Set<string>();
  private localMessagesSub?: any;

  constructor(
    protected override route: ActivatedRoute,
    protected override firestore: Firestore,
    protected override authService: AuthService,
    private channelService: ChannelService
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
    // Ensure we also load profiles for any authorIds found in the message stream
    this.localMessagesSub = this.messages$.subscribe((messages) => {
      const authorIds = new Set<string>();
      for (const m of messages || []) {
        if (m?.authorId && m.authorId !== this.currentUserId) {
          authorIds.add(m.authorId);
        }
      }
      if (authorIds.size) {
        this.preloadMemberProfiles(Array.from(authorIds));
      }
    });
  }

  /**
   * Cleanup for the local messages subscription.
   * The base hook disposes route/auth/messages subscriptions; here we dispose
   * the additional subscription used for author profile preloading.
   */
  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.localMessagesSub?.unsubscribe?.();
  }

  /**
   * Triggered when the route chatId changes.
   * Loads channel metadata and preloads member profiles so names/avatars are ready.
   */
  override onChatIdChanged(chatId: string): void {
    this.channelService.getChannel(chatId).subscribe({
      next: (data) => {
        this.channelData = data;
        const members = data?.members ?? [];
        if (Array.isArray(members) && members.length) {
          this.preloadMemberProfiles(members);
        }
      },
      error: (err) => console.error('Error fetching channel data:', err),
    });
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
        } catch (e) {
          // ignore individual failures
        }
      }
    }
  }
}
