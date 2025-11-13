import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';

@Component({
  selector: 'app-emoji-picker-component',
  standalone: true,
  imports: [PickerComponent],
  templateUrl: './emoji-picker-component.html',
  styleUrl: './emoji-picker-component.scss',
})
export class EmojiPickerComponent {
  @Input() showEmojiPicker = false;
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() closePicker = new EventEmitter<void>();

  addEmoji(event: any) {
    this.emojiSelected.emit(event.emoji.native);
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // If click is not on the picker or the button, close picker
    if (!target.closest('.emoji-picker-container') && !target.closest('.icon-btn')) {
      this.closePicker.emit();
    }
  }
}
