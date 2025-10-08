import { Component } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';

@Component({
  selector: 'app-thread-sidenav-content',
  imports: [MessageAreaComponent],
  templateUrl: './thread-sidenav-content.html',
  styleUrl: './thread-sidenav-content.scss',
})
export class ThreadSidenavContent {}
