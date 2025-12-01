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
export class DevspaceSidenavContent implements OnInit, OnDestroy {
  users: User[] = [];
  private searchBusSub?: Subscription;
  channels: any[] = [];

  meUid: string | null = null;

  search = '';
  searchCtrl = new FormControl<string>('', { nonNullable: true }); // 👈 neu
  private searchCtrlSub?: Subscription;

  activeIndex: number | null = null;

  private currentUserSub?: Subscription;

  constructor(
    private searchBus: SearchBusService,
    public viewStateService: ViewStateService,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.subscribeToCurrentUser();
    this.subscribeToSearchControl();
    this.subscribeToSearchBus();
  }

  ngOnDestroy(): void {
    this.currentUserSub?.unsubscribe();
    this.searchCtrlSub?.unsubscribe();
    this.searchBusSub?.unsubscribe();
  }

  private subscribeToCurrentUser(): void {
    this.currentUserSub = this.authService.currentUser$.subscribe((user) => {
      this.meUid = user ? user.uid : null;
    });
  }

  openNewDM() {
    this.viewStateService.currentView = 'chat';
    this.router.navigate(['/workspace/dm/new']);
  }

  private subscribeToSearchControl(): void {
    this.searchCtrlSub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.searchBus.set(q || ''));
  }

  private subscribeToSearchBus(): void {
    this.searchBusSub = this.searchBus.query$.subscribe((q) => {
      this.search = q;
      if (q !== this.searchCtrl.value) {
        this.searchCtrl.setValue(q, { emitEvent: false });
      }
    });
  }
}
