import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-devspace-sidenav-content',
  imports: [MatButtonModule, MatSidenavModule],
  templateUrl: './devspace-sidenav-content.html',
  styleUrl: './devspace-sidenav-content.scss',
})
export class DevspaceSidenavContent {

  dmsOpen: boolean = true;
  channelsOpen: boolean = true;

}
