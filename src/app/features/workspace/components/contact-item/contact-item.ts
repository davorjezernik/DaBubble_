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
export class ContactItem implements OnInit, OnDestroy {
  @Input() user: any;
  @Input() meUid: string | null = null;
  @Output() contactClick = new EventEmitter<any>();

  unread = 0;
  private sub?: Subscription;
  private read = inject(ReadStateService);

  ngOnInit(): void {
    if (!this.meUid || !this.user?.uid) return;
    const dmId = this.calculateDmId(this.meUid, this.user.uid);
    this.sub = this.read.unreadDmCount$(dmId, this.meUid).subscribe((c) => (this.unread = c));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onContactClick() {
    this.contactClick.emit(this.user);
  }

  private calculateDmId(a: string, b: string) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }
}
