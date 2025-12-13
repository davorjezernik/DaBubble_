import { Component, inject, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { User } from './../../../../models/user.class';
import { UserService } from './../../../../services/user.service';
import { DialogEditUserCardComponent } from '../dialog-edit-user-card/dialog-edit-user-card';
import { take } from 'rxjs/operators';
import { pipe, Subscription } from 'rxjs';
import { ReadStateService } from '../../../../services/read-state.service';
import { Router } from '@angular/router';
import { AvatarSelectComponent } from '../../../features/authentication/components/avatar-selection/avatar-selection-component';

@Component({
  selector: 'app-dialog-user-card',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './dialog-user-card.component.html',
  styleUrls: ['./dialog-user-card.component.scss', './dialog-user-card.responsive.scss'],
})
export class DialogUserCardComponent implements OnInit, OnDestroy {
  private read = inject(ReadStateService);

  unread = 0;
  isSelf = false;

  meUid: string | null = null;

  private unreadDmCountSub?: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { user: User },
    public dialogRef: MatDialogRef<DialogUserCardComponent>,
    private dialog: MatDialog,
    private userService: UserService,
    private router: Router
  ) {}

  /**
   * Determine whether the dialog is opened for the current user.
   * Sets `isSelf` by comparing authenticated uid with target user.
   */
  ngOnInit() {
    this.userService
      .currentUser$()
      .pipe(take(1))
      .subscribe((me) => {
        this.meUid = me?.uid ?? null;
        const u: any = this.data.user;
        const targetId = u.uid ?? u.id;
        this.isSelf = !!me && !!targetId && me.uid === targetId;
      });
  }

  ngOnDestroy(): void {
    this.unreadDmCountSub?.unsubscribe();
  }

  /**
   * Start edit flow when editing own profile.
   * Closes current dialog, opens edit dialog, then persists new name.
   */
  onEditUser() {
    if (!this.isSelf) return;
    this.dialogRef.close();
    this.dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(() => {
        const ref = this.openDialogEditUserCard();
        this.updateUserName(ref);
      });
  }

  /**
   * Subscribe to edit dialog close and update the user's display name.
   * @param ref Reference to the edit dialog
   */
  private updateUserName(ref: MatDialogRef<DialogEditUserCardComponent>) {
    ref
      .afterClosed()
      .pipe(take(1))
      .subscribe(async (newName?: string) => {
        if (!newName) return;
        await this.userService.updateUserName(this.data.user.uid, newName);
      });
  }

  /**
   * Open the edit user card dialog with the current user data.
   * @returns MatDialogRef for the edit dialog
   */
  private openDialogEditUserCard() {
    return this.dialog.open(DialogEditUserCardComponent, {
      data: { user: this.data.user },
      panelClass: 'user-edit-dialog',
      width: '600px',
      height: '596px',
      maxWidth: 'none',
      autoFocus: false,
    });
  }

  /**
   * Replace broken avatar image source with a default placeholder.
   * @param evt Image error event
   */
  fallbackAvatar(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/img-profile/profile.png';
  }

  /**
   * Navigates to the direct message channel with the selected user.
   * Closes all open dialogs before navigation.
   */
  public moveToUserDm() {
    if (!this.meUid || !this.data.user?.uid) return;
    const dmId = this.calculateDmId(this.data.user);
    this.unreadDmCountSub = this.read
      .unreadDmCount$(dmId, this.meUid)
      .pipe(take(1))
      .subscribe((c: any) => (this.unread = c));
    this.router.navigate(['/workspace/dm', dmId]);
    this.dialogRef.close();
  }

  /**
   * Generates a consistent DM ID based on the current user's ID and the other user's ID.
   * The ID is formed by sorting the two UIDs alphabetically to ensure uniqueness regardless of who initiates.
   * @param otherUser The user to start a DM with.
   * @returns The generated DM ID string.
   */
  public calculateDmId(otherUser: User): string {
    if (!this.meUid) return '';
    const uid1 = this.meUid;
    const uid2 = otherUser.uid;
    return uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;
  }

  /** Opens the avatar selection dialog to change the user's avatar.
   * @param ev Optional mouse event to stop propagation.
   */
  openEditAvatar(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.dialog.open(AvatarSelectComponent, {
      data: { user: this.data.user },
      autoFocus: false,
    });
  }
}
