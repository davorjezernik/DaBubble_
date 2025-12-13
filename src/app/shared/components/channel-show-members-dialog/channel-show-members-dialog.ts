import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';

export interface ChannelMember {
  id: string;
  name?: string;
  avatar?: string;
  online?: boolean;
}

@Component({
  selector: 'app-channel-show-members-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './channel-show-members-dialog.html',
  styleUrl: './channel-show-members-dialog.scss',
})
export class ChannelShowMembersDialog {
  @Input() members: any[] = [];
  @Input() currentUserId = '';
  @Input() channelName = '';
  @Input() addIconAnchor: HTMLElement | null = null;

  @Output() close = new EventEmitter<void>();

  @Output() addMembersClick = new EventEmitter<{ ev: MouseEvent; anchor?: HTMLElement }>();

  /**
   * Initializes the component with dependency injection.
   * @param dialog Service for opening Material Design dialogs.
   */
  constructor(private dialog: MatDialog) {}

  /**
   * Prevents event propagation.
   * @param e The mouse event.
   */
  stop(e: MouseEvent) {
    e.stopPropagation();
  }

  /**
   * Opens a user card dialog for the selected member.
   * @param member The channel member whose card to open.
   * @param e The mouse event, to stop its propagation.
   */
  openUserCard(member: any, e?: MouseEvent) {
    e?.stopPropagation();
    const isSelf = member.id === this.currentUserId;

    this.openDialogUserCard(member, isSelf);
  }

  /**
   * Configures and opens the user card dialog.
   * @param member The user data to display.
   * @param isSelf A boolean indicating if the user is viewing their own card.
   */
  private openDialogUserCard(member: any, isSelf: boolean) {
    this.dialog.open(DialogUserCardComponent, {
      data: {
        user: member,
        isSelf,
      },
      panelClass: 'user-card-dialog',
      width: '90vw',
      maxWidth: '500px',
      maxHeight: '91vh',
      autoFocus: false,
      restoreFocus: true,
    });
  }

  /**
   * Emits an event to open the 'add members' UI, positioned relative to an anchor element.
   * @param ev The mouse event.
   * @param anchor The HTML element to anchor the UI to.
   */
  openAddMembersUnderIcon(ev: MouseEvent, anchor?: HTMLElement) {
    ev.stopPropagation();
    this.addMembersClick.emit({
      ev,
      anchor: this.addIconAnchor ?? anchor ?? (ev.currentTarget as HTMLElement),
    });
  }
}
