import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { User } from '../../../../../models/user.class';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { SearchBusService } from '../../../../../services/search-bus.service';
import { ViewStateService } from '../../../../../services/view-state.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DmList } from './components/dm-list/dm-list';
import { ChannelList } from './components/channel-list/channel-list';
import { AuthService } from '../../../../../services/auth-service';

@Component({
  selector: 'app-devspace-sidenav-content',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSidenavModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    RouterModule,
    FormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    DmList,
    ChannelList,
  ],
  templateUrl: './devspace-sidenav-content.html',
  styleUrls: ['./devspace-sidenav-content.scss', './devspace-sidenav-content.responsive.scss'],
})
/**
 * Sidenav content for the workspace.
 * Handles search input and passes it to DM and channel lists.
 */
export class DevspaceSidenavContent implements OnInit, OnDestroy {
  /** Cached list of users (currently not filled here but kept for future use). */
  users: User[] = [];
  private searchBusSub?: Subscription;
  /** Channels shown in the sidebar (filled by child components). */
  channels: any[] = [];

  /** UID of the currently logged-in user. */
  meUid: string | null = null;

  /** Current search string shown in the search input. */
  search = '';
  /** Reactive form control for the search field. */
  searchCtrl = new FormControl<string>('', { nonNullable: true }); // 👈 neu
  private searchCtrlSub?: Subscription;

  /** Index of the currently active item in the sidenav (if any). */
  activeIndex: number | null = null;

  private currentUserSub?: Subscription;

  /**
   * Creates an instance of the sidenav content component.
   * @param searchBus Service used to broadcast the current search query.
   * @param viewStateService Shared view state (e.g. max visible items).
   * @param authService Authentication service to get the current user.
   * @param router Angular router, used by the template for navigation.
   */
  constructor(
    private searchBus: SearchBusService,
    public viewStateService: ViewStateService,
    private authService: AuthService,
    public router: Router
  ) {}

  /**
   * Lifecycle hook called once after component creation.
   * Sets up subscriptions to current user, search control, and search bus.
   */
  ngOnInit(): void {
    this.subscribeToCurrentUser();
    this.subscribeToSearchControl();
    this.subscribeToSearchBus();
  }

  /**
   * Lifecycle hook called just before the component is destroyed.
   * Cleans up all active subscriptions.
   */
  ngOnDestroy(): void {
    this.currentUserSub?.unsubscribe();
    this.searchCtrlSub?.unsubscribe();
    this.searchBusSub?.unsubscribe();
  }

  /**
   * Subscribes to the current user stream and keeps the UID in `meUid`.
   */
  private subscribeToCurrentUser(): void {
    this.currentUserSub = this.authService.currentUser$.subscribe((user) => {
      this.meUid = user ? user.uid : null;
    });
  }

  /**
   * Subscribes to changes of the search form control.
   * Debounces and forwards the query to the search bus service.
   */
  private subscribeToSearchControl(): void {
    this.searchCtrlSub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.searchBus.set(q || ''));
  }

  /**
   * Subscribes to the shared search bus and keeps the local
   * `search` and `searchCtrl` values in sync.
   */
  private subscribeToSearchBus(): void {
    this.searchBusSub = this.searchBus.query$.subscribe((q) => {
      this.search = q;
      if (q !== this.searchCtrl.value) {
        this.searchCtrl.setValue(q, { emitEvent: false });
      }
    });
  }
}
