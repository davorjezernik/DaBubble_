import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChannelMember {
  id: string;
  name?: string;
  avatar?: string;
  online?: boolean;
}

@Component({
  selector: 'app-channel-show-members-dialog',
  standalone: true, 
  imports: [
    CommonModule
  ],
  templateUrl: './channel-show-members-dialog.html',
  styleUrl: './channel-show-members-dialog.scss',
})
export class ChannelShowMembersDialog {
  @Input() members: ChannelMember[] = [];
  @Input() currentUserId = '';

  @Output() close = new EventEmitter<void>();
  @Output() addMembers = new EventEmitter<void>();

  // schließt den Dialog bei Klick außerhalb
  @HostListener('document:click')
  onDocClick() {
    this.close.emit();
  }

  stop(e: MouseEvent) {
    e.stopPropagation();
  }
}
