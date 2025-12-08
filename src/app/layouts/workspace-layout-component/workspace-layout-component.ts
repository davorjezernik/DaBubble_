import { Component, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { DevspaceSidenavContent } from '../../features/workspace/components/devspace-sidenav-content/devspace-sidenav-content';
import { ThreadSidenavContent } from '../../features/workspace/components/thread-sidenav-content/thread-sidenav-content';
import { HeaderWorkspaceComponent } from '../../features/workspace/components/header-workspace/header-workspace.component';
import { RouterModule } from '@angular/router';
import { ThreadPanelService, ThreadOpenRequest } from '../../../services/thread-panel.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Observable, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { ViewStateService } from '../../../services/view-state.service';
import { UserService } from '../../../services/user.service';
import { MatIconModule } from '@angular/material/icon';
import { User } from '../../../models/user.class';
import { UserMenuService } from '../../../services/user-menu.service';

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

  /**
   * Initialize component state and UI wiring.
   * Sets up user subscription, breakpoint observation, thread panel handling,
   * and drawer close listeners.
   */
  ngOnInit(): void {
    this.subscribeUserService();
    this.initializeBreakpointObserver();
    this.initializeThreadPanelSubscription();
    this.initializeDrawerListeners();
  }

  /**
   * Resubscribe to user stream when component inputs change.
   * Ensures `user` stays current across input-driven updates.
   */
  ngOnChanges(): void {
    this.subscribeUserService();
  }

  /**
   * Cleanup resources and subscriptions.
   * Unsubscribes all active streams to prevent memory leaks.
   */
  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.breakpointSub?.unsubscribe();
    this.drawerSubscriptions.unsubscribe();
  }

  /**
   * Observe viewport breakpoints and update layout state.
   * Closes thread/devspace drawers when width <= 1320px; marks mobile at 950px.
   * @param result BreakpointState provided to the subscription callback with matched flags.
   */
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

  /**
   * Subscribe to thread open events and open the thread drawer.
   * Stores the `ThreadOpenRequest` context and triggers drawer animation.
   * @param req ThreadOpenRequest received in the subscription callback for context (ids/view).
   */
  private initializeThreadPanelSubscription(): void {
    const sub = this.threadPanel.open$.subscribe((req: ThreadOpenRequest) => {
      this.threadContext = req;
      setTimeout(() => this.threadDrawer?.open());
    });
    this.drawerSubscriptions.add(sub);
  }

  /**
   * Subscribe to the current user stream and update presence.
   * Marks the user online when a user object is present.
   * @param user The authenticated user (or null) received in the subscription callback.
   */
  subscribeUserService() {
    this.userSub?.unsubscribe();
    this.userSub = this.userService
      .currentUser$()
      .pipe(distinctUntilChanged((prev, curr) => prev?.uid === curr?.uid))
      .subscribe((user) => {
        this.user = user;
        if (this.user) {
          this.userService.markOnline(true);
        }
      });
  }

  /**
   * Listen for drawer close events and close drawers accordingly.
   * Reacts to `closeThreadDrawer$` and `closeDevspaceDrawer$` signals.
   */
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
