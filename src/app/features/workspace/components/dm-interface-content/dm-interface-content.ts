import { Component } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../services/auth-service';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';
import { BaseChatInterfaceComponent } from '../base-chat-interface-component/base-chat-interface-component';
import { MatDialog } from '@angular/material/dialog';
import { DialogUserCardComponent } from '../../../../shared/components/dialog-user-card/dialog-user-card.component';
import { ReadStateService } from '../../../../../services/read-state.service';

@Component({
  selector: 'app-dm-interface-content',
  standalone: true,
  imports: [CommonModule, MessageAreaComponent, MessageBubbleComponent],
  templateUrl: './dm-interface-content.html',
  styleUrl: './dm-interface-content.scss',
})
/**
 * DM chat content component.
 * Inherits common chat behavior (message stream, scroll, helpers) from BaseChatInterfaceComponent
 * and adds DM-specific recipient loading and user card dialog.
 */
export class DmInterfaceContent extends BaseChatInterfaceComponent {
  override collectionName: 'channels' | 'dms' = 'dms';
  recipientData: any = null;
  isOwnDm: boolean = false;

  /**
   * Construct the DM interface component.
   * @param route ActivatedRoute used to read the current DM chatId from the URL.
   * @param firestore AngularFire Firestore instance for reading DM metadata and users.
   * @param authService AuthService providing the current authenticated user (uid etc.).
   * @param dialog Angular Material dialog service for opening the user card.
   */
  constructor(
    protected override route: ActivatedRoute,
    protected override firestore: Firestore,
    protected override authService: AuthService,
    private dialog: MatDialog,
    private read: ReadStateService
  ) {
    super(route, firestore, authService);
  }

  override onChatIdChanged(chatId: string): void {
    this.loadRecipientData(chatId);

    if (this.currentUserId) {
      this.read.markDmRead(chatId, this.currentUserId);
    } else {
      const sub = this.authService.currentUser$.subscribe((u) => {
        if (u?.uid) {
          this.read.markDmRead(chatId, u.uid);
          sub.unsubscribe();
        }
      });
    }
  }

  // for the message count //
  override async handleNewMessage(text: string) {
    if (!this.chatId) return;

    this.read.bumpLastMessage(this.chatId);

    await super.handleNewMessage(text);

    if (this.currentUserId) {
      await this.read.markDmRead(this.chatId, this.currentUserId);
    }
  }
  // for the message count //
  
  /**
   * Load the DM recipient's profile for the given chat.
   * - Determines if this is a self-DM (user messages themselves).
   * - Fetches the DM doc to extract members and resolves the other participant's profile.
   * @param chatId The DM document id in the collection `dms/`.
   * @returns Promise that resolves when recipient data has been set.
   */
  private async loadRecipientData(chatId: string): Promise<void> {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user) return;
    this.isOwnDm = chatId === `${user.uid}-${user.uid}`;
    const dmRef = doc(this.firestore, `dms/${chatId}`);
    const dmSnap = await getDoc(dmRef);

    if (dmSnap.exists()) {
      const dmData = dmSnap.data();
      const members = dmData['members'] as string[];
      const recipientId = members.find((id) => id !== user.uid);

      if (recipientId) {
        this.recipientData = await this.getUserData(recipientId);
      } else if (this.isOwnDm) {
        this.recipientData = await this.getUserData(user.uid);
      } else {
        this.recipientData = null;
      }
    } else {
      this.recipientData = null;
    }
  }

  /**
   * Open the user card dialog showing the recipient's profile details.
   * Uses Angular Material Dialog with fixed sizing and restores focus on close.
   */
  openUserCard(): void {
    if (!this.recipientData) return;

    this.dialog.open(DialogUserCardComponent, {
      data: { user: this.recipientData },
      panelClass: 'user-card-dialog',
      width: '500px',
      height: '705px',
      maxWidth: 'none',
      maxHeight: 'none',
      autoFocus: false,
      restoreFocus: true,
    });
  }
}
