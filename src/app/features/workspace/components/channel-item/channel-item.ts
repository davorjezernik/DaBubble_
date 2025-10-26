import { Component, Input, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-channel-item',
  imports: [RouterModule],
  templateUrl: './channel-item.html',
  styleUrl: './channel-item.scss'
})
export class ChannelItem implements OnInit {
  @Input() channel: any;


  ngOnInit(): void {
  }
}
