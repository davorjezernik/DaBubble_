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

  constructor(private dialog: MatDialog) {}

  stop(e: MouseEvent) {
    e.stopPropagation();
  }

  openUserCard(member: any, e?: MouseEvent) {
    e?.stopPropagation();
    const isSelf = member.id === this.currentUserId;

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

  openAddMembersUnderIcon(ev: MouseEvent, anchor?: HTMLElement) {
    ev.stopPropagation();
    this.addMembersClick.emit({
      ev,
      anchor: this.addIconAnchor ?? anchor ?? (ev.currentTarget as HTMLElement),
    });
  }
}
