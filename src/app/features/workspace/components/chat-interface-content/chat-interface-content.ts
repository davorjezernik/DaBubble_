import { Component } from '@angular/core';
import { MessageAreaComponentComponent } from "../../../../shared/components/message-area-component/message-area-component.component";

@Component({
  selector: 'app-chat-interface-component',
  imports: [
    MessageAreaComponentComponent,
  ],
  templateUrl: './chat-interface-content.html',
  styleUrl: './chat-interface-component.scss'
})
export class ChatInterfaceComponent {

}
