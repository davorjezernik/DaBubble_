import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmojiPickerComponent } from '../../emoji-picker-component/emoji-picker-component';

@Component({
  selector: 'app-message-edit-mode',
  standalone: true,
  imports: [CommonModule, EmojiPickerComponent],
  templateUrl: './message-edit-mode.component.html',
  styleUrl: './message-edit-mode.component.scss',
})
export class MessageEditModeComponent implements AfterViewInit, OnChanges {
  @Input() text: string = '';
  @Input() isSaving: boolean = false;
  @Input() isDeleting: boolean = false;
  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('editTextarea', { read: ElementRef })
  editTextareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('editEmojiPicker', { read: ElementRef }) editEmojiPickerRef?: ElementRef;
  @ViewChild('editEmojiButton', { read: ElementRef }) editEmojiButtonRef?: ElementRef;

  editText = '';
  editEmojiPickerVisible = false;

  constructor() {}

  /** Initialize view values and autosize the textarea after view is initialized. */
  ngAfterViewInit(): void {
    this.editText = this.text;
    setTimeout(() => this.autosizeEditTextarea());
  }

  /** Keep local editText in sync when the input text changes externally. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['text'] && !changes['text'].firstChange) {
      if (this.text !== this.editText) {
        this.editText = this.text;
      }
    }
  }

  /** Toggle edit emoji picker visibility. */
  toggleEditEmojiPicker(): void {
    this.editEmojiPickerVisible = !this.editEmojiPickerVisible;
  }

  /** Close edit emoji picker. */
  closeEditEmojiPicker(): void {
    this.editEmojiPickerVisible = false;
  }

  /**
   * Input handler for the edit textarea: updates text and auto-grows the field.
   */
  onEditInput(event: Event) {
    const target = event.target as HTMLTextAreaElement | null;
    this.editText = target?.value ?? '';
    this.autosizeEditTextarea();
  }

  /**
   * Add selected emoji into the edit textarea content.
   */
  onEditEmojiSelected(emoji: string) {
    this.editText = (this.editText || '') + emoji;
    this.closeEditEmojiPicker();
    this.autosizeEditTextarea();
  }

  /**
   * Resize the edit textarea to fit content without scrollbar.
   */
  private autosizeEditTextarea() {
    const el = this.editTextareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  /**
   * Handle save button click
   */
  onSave() {
    const trimmedText = (this.editText ?? '').trim();
    if (trimmedText) {
      this.save.emit(trimmedText);
    }
  }

  /**
   * Handle cancel button click
   */
  onCancel() {
    this.cancel.emit();
  }

  /**
   * Handle document click to close emoji picker if clicked outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.editEmojiPickerVisible) {
      const clickedInsideButton = this.editEmojiButtonRef?.nativeElement.contains(event.target);
      const clickedInsidePicker = this.editEmojiPickerRef?.nativeElement.contains(event.target);

      if (!clickedInsideButton && !clickedInsidePicker) {
        this.closeEditEmojiPicker();
      }
    }
  }
}
