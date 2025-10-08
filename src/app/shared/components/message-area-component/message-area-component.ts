import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
import { SharedComponentsModule } from '../shared-components/shared-components-module';

@Component({
  selector: 'app-message-area-component',
  standalone: true,
  imports: [CommonModule, FormsModule, EmojiPickerComponent, SharedComponentsModule],
  templateUrl: './message-area-component.html',
  styleUrl: './message-area-component.scss',
})
export class MessageAreaComponent {
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

  showEmojiPicker = false;

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmojiToText(emoji: string) {
    this.text += emoji; // append emoji to your textarea's value
  }
}
