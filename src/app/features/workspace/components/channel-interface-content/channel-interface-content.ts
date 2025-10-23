import { Component, Input } from '@angular/core';
import { MessageAreaComponent } from "../../../../shared/components/message-area-component/message-area-component";

@Component({
  selector: 'app-channel-interface-content',
  imports: [MessageAreaComponent],
  templateUrl: './channel-interface-content.html',
  styleUrl: './channel-interface-content.scss'
})
export class ChannelInterfaceContent {
}
