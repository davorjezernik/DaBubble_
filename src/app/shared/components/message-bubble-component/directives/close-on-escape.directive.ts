import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Directive that emits an event when the ESC key is pressed.
 * Useful for closing modals, menus, and pickers with keyboard.
 * 
 * Usage:
 * ```html
 * <div closeOnEscape [isOpen]="modalOpen" (close)="modalOpen = false">
 *   <div class="modal">...</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[closeOnEscape]',
  standalone: true
})
export class CloseOnEscapeDirective {
  /**
   * Whether the element is currently open/visible.
   * When false, ESC key detection is disabled.
   */
  @Input() isOpen = false;

  /**
   * Emits when the ESC key is pressed.
   */
  @Output() close = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.isOpen) return;
    this.close.emit();
  }
}
