import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Directive that emits an event when the ESC key is pressed.
 */
@Directive({
  selector: '[closeOnEscape]',
  standalone: true
})
export class CloseOnEscapeDirective {

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  /**
   * Handle global ESC key presses and emit `close` when the host is open.
   * Side effects: emits `close` if `isOpen` is true.
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.isOpen) return;
    this.close.emit();
  }
}
