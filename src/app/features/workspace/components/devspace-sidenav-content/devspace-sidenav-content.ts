import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest  } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';

@Component({
  selector: 'app-devspace-sidenav-content',
  imports: [MatButtonModule, MatSidenavModule, CommonModule],
  templateUrl: './devspace-sidenav-content.html',
  styleUrl: './devspace-sidenav-content.scss',
})

export class DevspaceSidenavContent implements OnInit, OnDestroy {
  users: User[] = [];
  private sub?: Subscription;

  dmsOpen = true;
  channelsOpen = true;

  // Users//

  pageSizeUsers = 4;
  maxVisible = this.pageSizeUsers;
  activeIndex: number | null = null;

  meUid: string | null = null;

  constructor(private usersService: UserService) {}

  ngOnInit(): void {
    this.sub = combineLatest([
      this.usersService.users$(),
      this.usersService.currentUser$(),  
    ]).subscribe(([list, me]) => {
      this.meUid = me?.uid ?? null;

      if (this.meUid) {
        const meUser = list.find(u => u.uid === this.meUid);
        const others = list.filter(u => u.uid !== this.meUid);
        // eigener Eintrag ganz oben
        this.users = meUser ? [meUser, ...others] : list;
      } else {
        this.users = list;
      }

      this.maxVisible = Math.min(this.maxVisible, this.users.length);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get visibleUsers(): User[] {
    return this.users.slice(0, Math.min(this.maxVisible, this.users.length));
  }

  get hiddenCount(): number {
    return Math.max(this.users.length - this.maxVisible, 0);
  }

  loadMore(): void {
    this.maxVisible = Math.min(this.maxVisible + this.pageSizeUsers, this.users.length);
  }

  setActive(i: number) {
    this.activeIndex = i;
  }

  trackById = (_: number, u: User) => u.uid;
}
