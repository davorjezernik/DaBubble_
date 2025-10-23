import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-channel-item',
  imports: [],
  templateUrl: './channel-item.html',
  styleUrl: './channel-item.scss'
})
export class ChannelItem {
  @Input() channel: any;
}
