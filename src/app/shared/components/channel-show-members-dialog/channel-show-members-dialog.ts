import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
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
  @Input() members: ChannelMember[] = [];
  @Input() currentUserId = '';

  @Output() close = new EventEmitter<void>();
  @Output() addMembers = new EventEmitter<void>();

  constructor(private dialog: MatDialog) {}

  stop(e: MouseEvent) {
    e.stopPropagation();
  }

  openUserCard(member: ChannelMember, e?: MouseEvent) {
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
      hasBackdrop: true,
      disableClose: false, 
    });
  }
}
