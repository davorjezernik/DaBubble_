import { Component, Inject, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-dialog-user-card',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './dialog-user-card.component.html',
  styleUrls: ['./dialog-user-card.component.scss', './dialog-user-card.responsive.scss'],
})
export class DialogUserCardComponent implements OnInit {
  isSelf = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { user: User },
    public dialogRef: MatDialogRef<DialogUserCardComponent>,
    private dialog: MatDialog,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.userService
      .currentUser$()
      .pipe(take(1))
      .subscribe((me) => {
        const u: any = this.data.user;
        const targetId = u.uid ?? u.id; 
        this.isSelf = !!me && !!targetId && me.uid === targetId;
      });
  }

  onEditUser() {
    if (!this.isSelf) return;
    this.dialogRef.close();
    this.dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(() => {
        const ref = this.dialog.open(DialogEditUserCardComponent, {
          data: { user: this.data.user },
          panelClass: 'user-edit-dialog',
          width: '600px',
          height: '596px',
          maxWidth: 'none',
          autoFocus: false,
        });

        ref
          .afterClosed()
          .pipe(take(1))
          .subscribe(async (newName?: string) => {
            if (!newName) return;
            await this.userService.updateUserName(this.data.user.uid, newName);
          });
      });
  }

  fallbackAvatar(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/img-profile/profile.png';
  }
}
