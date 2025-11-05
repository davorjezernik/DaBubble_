import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { DevspaceSidenavContent } from '../../features/workspace/components/devspace-sidenav-content/devspace-sidenav-content';
import { ThreadSidenavContent } from '../../features/workspace/components/thread-sidenav-content/thread-sidenav-content';
import { HeaderWorkspaceComponent } from '../../features/workspace/components/header-workspace/header-workspace.component';
import { RouterModule } from '@angular/router';
import { ThreadPanelService, ThreadOpenRequest } from '../../../services/thread-panel.service';

@Component({
  selector: 'app-workspace-layout-component',
  imports: [
    MatSidenavModule,
    DevspaceSidenavContent,
    RouterModule,
    ThreadSidenavContent,
    HeaderWorkspaceComponent,
  ],
  templateUrl: './workspace-layout-component.html',
  styleUrl: './workspace-layout-component.scss',
})
export class WorkspaceLayoutComponent implements OnInit {
  @ViewChild('threadDrawer') threadDrawer?: MatDrawer;
  threadContext?: ThreadOpenRequest;

  constructor(private threadPanel: ThreadPanelService) {}

  ngOnInit(): void {
    this.threadPanel.open$.subscribe((req: ThreadOpenRequest) => {
      this.threadContext = req;
      // Defer to ensure the drawer ViewChild is available
      setTimeout(() => this.threadDrawer?.open());
    });
  }
}
