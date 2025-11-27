import { Component, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
  ],
  templateUrl: './workspace-layout-component.html',
  styleUrls: ['./workspace-layout-component.scss', './workspace-layout-component.responsive.scss'],
})
export class WorkspaceLayoutComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('threadDrawer') threadDrawer?: MatDrawer;
  @ViewChild('devspaceDrawer') devspaceDrawer?: MatDrawer;

  user: User | null = null;
  user$: Observable<User | null>;

  threadContext?: ThreadOpenRequest;

  breakpointSub?: Subscription;
  userSub?: Subscription;
  private drawerSubscriptions = new Subscription();

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
    this.subscribeUserService();
    this.initializeBreakpointObserver();
    this.initializeThreadPanelSubscription();
    this.initializeDrawerListeners();
  }

  ngOnChanges(): void {
    this.subscribeUserService();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.breakpointSub?.unsubscribe();
    this.drawerSubscriptions.unsubscribe();
  }

  private initializeBreakpointObserver(): void {
    this.breakpointSub = this.breakpointObserver
      .observe(['(max-width: 950px)', '(max-width: 1320px)'])
      .subscribe((result) => {
        this.viewStateService.isMobileView = result.breakpoints['(max-width: 950px)'];

        if (result.breakpoints['(max-width: 1320px)']) {
          this.threadDrawer?.close();
          this.devspaceDrawer?.close();
        }
      });
  }

  private initializeThreadPanelSubscription(): void {
    this.threadPanel.open$.subscribe((req: ThreadOpenRequest) => {
      this.threadContext = req;
      setTimeout(() => this.threadDrawer?.open());
    });
  }

  subscribeUserService() {
    this.userSub = this.userService.currentUser$().subscribe((user) => {
      this.user = user;
      if (this.user) {
        this.userService.markOnline(true);
      }
    });
  }

  private initializeDrawerListeners(): void {
    const threadSub = this.viewStateService.closeThreadDrawer$.subscribe(() => {
      this.threadDrawer?.close();
    });

    const devspaceSub = this.viewStateService.closeDevspaceDrawer$.subscribe(() => {
      this.devspaceDrawer?.close();
    });

    this.drawerSubscriptions.add(threadSub);
    this.drawerSubscriptions.add(devspaceSub);
  }
}

