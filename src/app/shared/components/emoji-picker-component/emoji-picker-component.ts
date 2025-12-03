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

  /**
   * Emit the selected emoji's unicode string from emoji-mart picker event.
   * @param event Emoji-mart selection event containing `emoji.native`
   */
  addEmoji(event: any) {
    this.emojiSelected.emit(event.emoji.native);
  }

  @HostListener('document:click', ['$event'])
  /** Close picker when clicking outside the picker container or trigger button. */
  clickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.emoji-picker-container') && !target.closest('.icon-btn')) {
      this.closePicker.emit();
    }
  }
}
