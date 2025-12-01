import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ReadStateService } from '../../../../../services/read-state.service';

@Component({
  selector: 'app-channel-item',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './channel-item.html',
  styleUrl: './channel-item.scss',
})
/**
 * Renders a single channel entry with its unread message counter.
 * Listens to read-state changes for the given user and channel.
 */
export class ChannelItem implements OnInit, OnDestroy, OnChanges {
  /** Channel object (must contain at least an `id`). */
  @Input() channel: any;
  /** UID of the current user used to compute unread count. */
  @Input() meUid: string | null = null;

  unread = 0;
  private sub?: Subscription;
  private read = inject(ReadStateService);

  /**
   * Initial lifecycle hook: sets up the unread subscription.
   */
  ngOnInit(): void {
    this.setupSub();
  }

  /**
   * React to changes of `meUid` or `channel` inputs by
   * re-subscribing to the unread counter.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['meUid'] || changes['channel']) {
      this.setupSub();
    }
  }

  /**
   * Subscribe to unread-channel count for the current user and channel.
   * Resets unread to 0 if input data is incomplete.
   */
  private setupSub() {
    this.sub?.unsubscribe();
    if (!this.meUid || !this.channel?.id) {
      this.unread = 0;
      return;
    }

    this.sub = this.read
      .unreadChannelCount$(this.channel.id, this.meUid)
      .subscribe((c) => (this.unread = c));
  }

  /** Clean up the unread subscription when the component is destroyed. */
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
