import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';

@Component({
  selector: 'app-message-area-component',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerComponent],
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

  showEmojiPicker = false;

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

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(event: any) {
    this.text += event.emoji.native;
    this.showEmojiPicker = false;
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // If click is not on the picker or the button, close picker
    if (!target.closest('.emoji-picker-container') && !target.closest('.icon-btn')) {
      this.showEmojiPicker = false;
    }
  }
}
