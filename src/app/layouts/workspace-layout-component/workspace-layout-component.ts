import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { DevspaceSidenavContent } from '../../features/workspace/components/devspace-sidenav-content/devspace-sidenav-content';
import { ThreadSidenavContent } from '../../features/workspace/components/thread-sidenav-content/thread-sidenav-content';
import { HeaderWorkspaceComponent } from '../../features/workspace/components/header-workspace/header-workspace.component';
import { RouterModule } from '@angular/router';
import { ThreadPanelService, ThreadOpenRequest } from '../../../services/thread-panel.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { ViewStateService } from '../../../services/view-state.service';

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
  styleUrls: ['./workspace-layout-component.scss', './workspace-layout-component.responsive.scss'],
})
export class WorkspaceLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('threadDrawer') threadDrawer?: MatDrawer;
  @ViewChild('devspaceDrawer') devspaceDrawer?: MatDrawer;

  threadContext?: ThreadOpenRequest;
  isMobileView: boolean = false;

  breakpointSub?: Subscription;

  constructor(
    private threadPanel: ThreadPanelService,
    private breakpointObserver: BreakpointObserver,
    public viewStateService: ViewStateService
  ) {}

  ngOnInit(): void {
    this.breakpointSub = this.breakpointObserver
      .observe(['(max-width: 1300px)'])
      .subscribe((result) => {
        this.isMobileView = result.matches;
      });

    this.threadPanel.open$.subscribe((req: ThreadOpenRequest) => {
      this.threadContext = req;
      // Defer to ensure the drawer ViewChild is available
      setTimeout(() => this.threadDrawer?.open());
    });
  }

  ngOnDestroy(): void {
    this.breakpointSub?.unsubscribe();
  }
}
