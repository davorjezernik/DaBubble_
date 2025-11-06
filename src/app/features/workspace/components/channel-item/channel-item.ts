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
export class ChannelItem implements OnInit, OnDestroy, OnChanges {
  @Input() channel: any;
  @Input() meUid: string | null = null;

  unread = 0;
  private sub?: Subscription;
  private read = inject(ReadStateService);

  ngOnInit(): void {
    this.setupSub();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['meUid'] || changes['channel']) {
      this.setupSub();
    }
  }
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
