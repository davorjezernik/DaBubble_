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


@Component({
  selector: 'app-dm-interface-content',
  standalone: true,
  imports: [CommonModule, MessageAreaComponent, MessageBubbleComponent],
  templateUrl: './dm-interface-content.html',
  styleUrl: './dm-interface-content.scss',
})
export class DmInterfaceContent extends BaseChatInterfaceComponent {
  override collectionName: 'channels' | 'dms' = 'dms';
  recipientData: any = null;
  isOwnDm: boolean = false;

  constructor(
    protected override route: ActivatedRoute,
    protected override firestore: Firestore,
    protected override authService: AuthService,
    private dialog: MatDialog
  ) {
    super(route, firestore, authService);
  }

  override onChatIdChanged(chatId: string): void {
    this.loadRecipientData(chatId);
  }

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
