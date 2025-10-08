import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
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

  dmsOpen: boolean = true;
  channelsOpen: boolean = true;

  // Users//

  pageSizeUsers = 4;
  maxVisible = this.pageSizeUsers;
  activeIndex: number | null = null;

  constructor(private usersService: UserService) {}

  ngOnInit(): void {
    this.sub = this.usersService.users$().subscribe((list) => {
      this.users = list;
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
