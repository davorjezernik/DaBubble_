import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-channel-item',
  imports: [RouterModule],
  templateUrl: './channel-item.html',
  styleUrl: './channel-item.scss'
})
export class ChannelItem {
  @Input() channel: any;
}
