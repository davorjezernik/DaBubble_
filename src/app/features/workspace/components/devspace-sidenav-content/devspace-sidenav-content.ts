import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

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

  currentUser = localStorage.getItem('user');
  currentDmId: string = '';

  // Users//

  pageSizeUsers = 4;
  maxVisible = this.pageSizeUsers;
  activeIndex: number | null = null;

  constructor(
    private usersService: UserService,
    private firestore: Firestore,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sub = this.usersService.users$().subscribe((list) => {
      if (this.currentUser) {
        this.users = list.filter((u) => u.uid !== JSON.parse(this.currentUser!).uid);
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

  async openDirectMessages(i: number, otherUser: User) {
    this.activeIndex = i;

    const loggedInUser = localStorage.getItem('user');
    console.log(otherUser);
    if (!loggedInUser) return;

    const uid1 = JSON.parse(loggedInUser).uid;
    const uid2 = otherUser.uid;

    this.currentDmId = uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;

    const docRef = doc(this.firestore, 'dms', this.currentDmId);

    await setDoc(docRef, { members: [uid1, uid2] }, { merge: true });
  }

  trackById = (_: number, u: User) => u.uid;

  
}
