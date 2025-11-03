import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { DevspaceSidenavContent } from '../../features/workspace/components/devspace-sidenav-content/devspace-sidenav-content';
import { ThreadSidenavContent } from '../../features/workspace/components/thread-sidenav-content/thread-sidenav-content';
import { HeaderWorkspaceComponent } from '../../features/workspace/components/header-workspace/header-workspace.component';
import { RouterModule } from '@angular/router';
import { ThreadPanelService, ThreadOpenRequest } from '../../../services/thread-panel.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Observable, Subscription } from 'rxjs';
import { ViewStateService } from '../../../services/view-state.service';
import { UserService } from '../../../services/user.service';
import { MatIconModule } from '@angular/material/icon';
import { User } from '../../../models/user.class';
import { UserMenuService } from '../../../services/user-menu.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-workspace-layout-component',
  imports: [
    MatSidenavModule,
    DevspaceSidenavContent,
    RouterModule,
    ThreadSidenavContent,
    HeaderWorkspaceComponent,
    MatIconModule,
    AsyncPipe
  ],
  templateUrl: './workspace-layout-component.html',
  styleUrls: ['./workspace-layout-component.scss', './workspace-layout-component.responsive.scss'],
})
export class WorkspaceLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('threadDrawer') threadDrawer?: MatDrawer;
  @ViewChild('devspaceDrawer') devspaceDrawer?: MatDrawer;

  user: User | null = null;
  user$: Observable<User | null>;

  threadContext?: ThreadOpenRequest;
  isMobileView: boolean = false;

  breakpointSub?: Subscription;
  userSub?: Subscription;

  constructor(
    private threadPanel: ThreadPanelService,
    private breakpointObserver: BreakpointObserver,
    public viewStateService: ViewStateService,
    private userService: UserService,
    public userMenuService: UserMenuService
  ) {
    this.user$ = this.userService.currentUser$();
  }

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

  subscribeUserService() {
    this.userSub = this.userService.currentUser$().subscribe((user) => {
      this.user = user;
    });
  }
}
