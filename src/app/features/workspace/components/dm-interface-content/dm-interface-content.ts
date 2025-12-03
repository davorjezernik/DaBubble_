import { Component } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
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
  styleUrls: ['./dm-interface-content.scss', './dm-interface-component.responsive.scss'],
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

  /**
   * Reacts to DM chatId changes by loading recipient metadata and
   * marking the conversation as read for the current user.
   *
   * @param chatId - The DM chat document ID.
   */
  override onChatIdChanged(chatId: string): void {
    this.loadRecipientData(chatId);

    if (this.currentUserId) {
      this.read.markDmRead(chatId, this.currentUserId);
    } else {
      this.authService.currentUser$.pipe(take(1)).subscribe((u) => {
        if (u?.uid) {
          this.read.markDmRead(chatId, u.uid);
        }
      });
    }
  }

  /**
   * Handles sending a new DM message and updates read/bump state accordingly.
   *
   * @param text - Message text content to send.
   * @returns Promise resolved when the message is processed.
   */
  override async handleNewMessage(text: string) {
    if (!this.chatId) return;

    this.read.bumpLastMessage(this.chatId);

    await super.handleNewMessage(text);

    if (this.currentUserId) {
      await this.read.markDmRead(this.chatId, this.currentUserId);
    }
  }

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
    const dmSnap = await this.getDmSnap(chatId);

    if (dmSnap.exists()) {
      const recipientId = this.getRecipientId(dmSnap, user);
      await this.setRecipientData(recipientId, user);
    } else {
      this.recipientData = null;
    }
  }

  /**
   * Resolves and sets `recipientData` based on recipientId and self-DM status.
   *
   * @param recipientId - UID of the other member in the DM.
   * @param user - Current authenticated user.
   */
  private async setRecipientData(recipientId: string | undefined, user: any) {
    if (recipientId) {
      this.recipientData = await this.getUserData(recipientId);
    } else if (this.isOwnDm) {
      this.recipientData = await this.getUserData(user.uid);
    } else {
      this.recipientData = null;
    }
  }

  /**
   * Determines the recipient UID from the DM snapshot excluding the current user.
   *
   * @param dmSnap - Firestore document snapshot of the DM.
   * @param user - Current user used for exclusion.
   * @returns The recipient's UID if found.
   */
  private getRecipientId(dmSnap: any, user: any) {
    const dmData = dmSnap.data();
    const members = dmData['members'] as string[];
    return members.find((id) => id !== user.uid);
  }

  /**
   * Fetches the DM document snapshot from Firestore by chatId.
   *
   * @param chatId - The DM document ID.
   * @returns Promise resolving to the document snapshot.
   */
  private async getDmSnap(chatId: string) {
    const dmRef = doc(this.firestore, `dms/${chatId}`);
    return getDoc(dmRef);
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
      width: '90vw',
      maxWidth: '500px',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: true,
    });
  }
}
