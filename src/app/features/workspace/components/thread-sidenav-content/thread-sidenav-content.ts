import { Component } from '@angular/core';
import { MessageAreaComponentComponent } from "../../../../shared/components/message-area-component/message-area-component.component";

@Component({
  selector: 'app-thread-sidenav-content',
  imports: [
    MessageAreaComponentComponent,
  ],
  templateUrl: './thread-sidenav-content.html',
  styleUrl: './thread-sidenav-content.scss'
})
export class ThreadSidenavContent {

}
