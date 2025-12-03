import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ReadStateService } from '../../../../../services/read-state.service';

@Component({
  selector: 'app-contact-item',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './contact-item.html',
  styleUrl: './contact-item.scss',
})
/**
 * Renders a single DM contact entry with unread counter.
 * Emits a click event when the contact is selected.
 */
export class ContactItem implements OnInit, OnDestroy {
  /** The contact user object (needs at least `uid`). */
  @Input() user: any;
  /** UID of the currently logged-in user (to compute DM id). */
  @Input() meUid: string | null = null;
  /** Emitted when the contact item is clicked. */
  @Output() contactClick = new EventEmitter<any>();

  unread = 0;
  private sub?: Subscription;
  private read = inject(ReadStateService);

  /**
   * Subscribe to unread DM count for this contact.
   * Does nothing if `meUid` or `user.uid` is missing.
   */
  ngOnInit(): void {
    if (!this.meUid || !this.user?.uid) return;
    const dmId = this.calculateDmId(this.meUid, this.user.uid);
    this.sub = this.read.unreadDmCount$(dmId, this.meUid).subscribe((c) => (this.unread = c));
  }

  /** Clean up the unread subscription on destroy. */
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Emit the `contactClick` event with the full user object. */
  onContactClick() {
    this.contactClick.emit(this.user);
  }

  /**
   * Build a stable DM id from two user ids (order-independent).
   */
  private calculateDmId(a: string, b: string) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }
}
