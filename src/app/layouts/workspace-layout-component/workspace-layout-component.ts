import { Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { DevspaceSidenavContent } from '../../features/workspace/components/devspace-sidenav-content/devspace-sidenav-content';
import { ThreadSidenavContent } from '../../features/workspace/components/thread-sidenav-content/thread-sidenav-content';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-workspace-layout-component',
  imports: [MatSidenavModule, DevspaceSidenavContent, ThreadSidenavContent, RouterModule],
  templateUrl: './workspace-layout-component.html',
  styleUrl: './workspace-layout-component.scss',
})
export class WorkspaceLayoutComponent {}
