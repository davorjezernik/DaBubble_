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

  constructor(
    protected override route: ActivatedRoute,
    protected override firestore: Firestore,
    protected override authService: AuthService,
    private channelService: ChannelService
  ) {
    super(route, firestore, authService);
  }

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

  private async preloadMemberProfiles(memberIds: string[]): Promise<void> {
    const unique = Array.from(new Set(memberIds)).filter(Boolean);
    for (const uid of unique) {
      if (!this.memberProfiles[uid]) {
        try {
          const profile = await this.getUserData(uid);
          if (profile) {
            this.memberProfiles[uid] = profile;
          }
        } catch (e) {
          // ignore individual failures
        }
      }
    }
  }
}
