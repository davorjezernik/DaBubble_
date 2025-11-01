import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { DialogUserCardComponent } from '../dialog-user-card/dialog-user-card.component';
import { DialogIconAddMemberToChannel } from '../dialog-icon-add-member-to-channel/dialog-icon-add-member-to-channel';

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
  @Input() members: ChannelMember[] = [];
  @Input() currentUserId = '';
  @Input() channelName = '';
  @Input() addIconAnchor: HTMLElement | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() addMembers = new EventEmitter<void>();

  constructor(private dialog: MatDialog) {}

  stop(e: MouseEvent) {
    e.stopPropagation();
  }

  openUserCard(member: ChannelMember, e?: MouseEvent) {
    e?.stopPropagation();

    const isSelf = member.id === this.currentUserId;

    const userLike: any = {
      uid: member.id,
      name: member.name,
      avatar: member.avatar,
      online: member.online,
    };

    const ref = this.dialog.open(DialogUserCardComponent, {
      data: { user: userLike },
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

    const anchorEl = this.addIconAnchor ?? anchor ?? (ev.currentTarget as HTMLElement);

    const rect = anchorEl.getBoundingClientRect();
    const GAP = 8;
    const DLG_W = 514;
    const DLG_H = 294;

    const top = rect.bottom + window.scrollY + GAP;
    const left = Math.max(8, rect.right + window.scrollX - DLG_W);

    const ref = this.dialog.open(DialogIconAddMemberToChannel, {
      panelClass: 'add-members-dialog-panel',
      backdropClass: 'transparent-backdrop',
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: true,
      width: `${DLG_W}px`,
      height: `${DLG_H}px`,
      position: { top: `${top}px`, left: `${left}px` },
    });

    ref.componentInstance.channelName = this.channelName;
    ref.componentInstance.close.subscribe(() => ref.close());
    ref.componentInstance.add.subscribe(() => ref.close());
  }
}
