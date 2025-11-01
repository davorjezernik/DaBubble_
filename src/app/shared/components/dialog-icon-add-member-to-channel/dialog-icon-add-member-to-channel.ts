import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dialog-icon-add-member-to-channel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialog-icon-add-member-to-channel.html',
  styleUrl: './dialog-icon-add-member-to-channel.scss',
})
export class DialogIconAddMemberToChannel {
  @Input() channelName = '';
  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<string>();

  name = '';

  stop(e: MouseEvent) { e.stopPropagation(); }
  submit() {
    const v = this.name.trim();
    if (v) this.add.emit(v);
  }
}
