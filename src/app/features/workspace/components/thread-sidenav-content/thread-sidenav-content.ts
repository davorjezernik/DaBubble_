import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';

@Component({
  selector: 'app-thread-sidenav-content',
  standalone: true,
  imports: [MessageAreaComponent],
  templateUrl: './thread-sidenav-content.html',
  styleUrl: './thread-sidenav-content.scss',
})
export class ThreadSidenavContent {
  @Input() chatId?: string;
  @Input() messageId?: string;
  @Input() collectionName: 'channels' | 'dms' = 'dms';

  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
