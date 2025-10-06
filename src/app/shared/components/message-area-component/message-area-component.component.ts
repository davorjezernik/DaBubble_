import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-message-area-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-area-component.component.html',
  styleUrl: './message-area-component.component.scss',
})
export class MessageAreaComponentComponent {
  @Input() hint = 'Nachricht an #Team';
  @Input() disabled = false;
  @Input() maxHeight = 240; // px
  @Output() send = new EventEmitter<string>();

  text = '';
  focused = false;

  @ViewChild('ta') ta!: ElementRef<HTMLTextAreaElement>;

  @Input() channelName = ''; 
  @Input() mode: 'channel' | 'thread' = 'channel'; 

  get hintText(): string {
    return this.mode === 'thread'
      ? 'Antworten'
      : this.channelName
      ? `Nachricht an #${this.channelName}`
      : 'Nachricht an #Team';
  }

  autoResize(el: HTMLTextAreaElement) {
    const baseHeight = 56;
    el.style.height = baseHeight + 'px';

    const next = Math.min(el.scrollHeight, this.maxHeight);
    el.style.height = next + 'px';
  }

  onEnter(e: KeyboardEvent) {
    if (!e.shiftKey) {
      e.preventDefault();
      this.triggerSend();
    }
  }

  triggerSend() {
    const value = this.text.trim();
    if (!value || this.disabled) return;
    this.send.emit(value);
    this.text = '';
    queueMicrotask(() => this.autoResize(this.ta.nativeElement));
  }
}
