import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { UserService } from '../../../../../services/user.service';
import { User } from '../../../../../models/user.class';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../services/auth-service';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { AddUsersToChannel } from '../add-users-to-channel/add-users-to-channel';

@Component({
  selector: 'app-devspace-sidenav-content',
  standalone: true,
  imports: [MatButtonModule, MatSidenavModule, CommonModule, FormsModule, MatDialogModule],
  templateUrl: './devspace-sidenav-content.html',
  styleUrl: './devspace-sidenav-content.scss',
})
export class DevspaceSidenavContent implements OnInit, OnDestroy {
  users: User[] = [];
  private sub?: Subscription;

  dmsOpen = true;
  channelsOpen = true;

  currentUser = localStorage.getItem('user');
  currentChatId: string = '';

  // Users//

  pageSizeUsers = 4;
  maxVisible = this.pageSizeUsers;
  activeIndex: number | null = null;

  meUid: string | null = null;

  constructor(
    private usersService: UserService,
    private firestore: Firestore,
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([
      this.usersService.users$(),
      this.usersService.currentUser$(),
    ]).subscribe(([list, me]) => {
      this.meUid = me?.uid ?? null;

      if (this.meUid) {
        const meUser = list.find((u) => u.uid === this.meUid);
        const others = list.filter((u) => u.uid !== this.meUid);
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

  async openDirectMessages(i: number, otherUser: User) {
    this.activeIndex = i;

    const user: any = await firstValueFrom(this.authService.currentUser$);
    if (!user) return;

    const uid1 = user.uid;
    const uid2 = otherUser.uid;

    this.currentChatId = uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;

    const docRef = doc(this.firestore, 'dms', this.currentChatId);

    await setDoc(docRef, { members: [uid1, uid2] }, { merge: true });

    this.router.navigate(['/workspace/dm', this.currentChatId]);
  }

  trackById = (_: number, u: User) => u.uid;

  openAddChannelDialog() {
    const dialogRef = this.dialog.open(AddChannel, {
      panelClass: 'dialog-panel',
      width: '80vw',
      maxWidth: '800px',
      minWidth: '300px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.channelName) {
        this.openAddUsersToChannelDialog(result);
      }
    });
  }

  openAddUsersToChannelDialog(result: any) {
    const addUsersDialogRef = this.dialog.open(AddUsersToChannel, {
      panelClass: 'dialog-panel',
      width: '80vw',
      maxWidth: '750px',
      minWidth: '300px',
      data: result,
    });
    addUsersDialogRef.afterClosed().subscribe((usersResult) => {
      if (usersResult) {
        this.saveChannel(usersResult);
      }
    });
  }

  async saveChannel(channelData: any) {
    const docRef = doc(collection(this.firestore, 'channels'));
    await setDoc( docRef, channelData, { merge: true } );
  }
}
