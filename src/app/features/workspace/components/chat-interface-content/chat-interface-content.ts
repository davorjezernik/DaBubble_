import { Component } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { MessageBubbleComponent } from '../../../../shared/components/message-bubble-component/message-bubble.component';

@Component({
  selector: 'app-chat-interface-component',
  imports: [MessageAreaComponent, MessageBubbleComponent],
  templateUrl: './chat-interface-content.html',
  styleUrl: './chat-interface-component.scss',
})
export class ChatInterfaceComponent {}
