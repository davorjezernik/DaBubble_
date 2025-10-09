import { Component } from '@angular/core';
import {MatSidenavModule} from '@angular/material/sidenav';
import { DevspaceSidenavContent } from "../../features/workspace/components/devspace-sidenav-content/devspace-sidenav-content";
import { ChatInterfaceComponent } from "../../features/workspace/components/chat-interface-content/chat-interface-content";
import { ThreadSidenavContent } from "../../features/workspace/components/thread-sidenav-content/thread-sidenav-content";

@Component({
  selector: 'app-workspace-layout-component',
  imports: [MatSidenavModule, DevspaceSidenavContent, ChatInterfaceComponent, ThreadSidenavContent],
  templateUrl: './workspace-layout-component.html',
  styleUrl: './workspace-layout-component.scss'
})
export class WorkspaceLayoutComponent {

}

