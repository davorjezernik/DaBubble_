import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';
import { DialogIconAddMemberToChannel, AddableUser  } from '../dialog-icon-add-member-to-channel/dialog-icon-add-member-to-channel';

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
    this.dialog.open(DialogUserCardComponent, {
      data: { user: member },
      panelClass: 'user-card-dialog',
      width: '500px',
      height: '705px',
      maxWidth: 'none',
      maxHeight: 'none',
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
