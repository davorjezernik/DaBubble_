import { Directive, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Directive that emits an event when a click occurs outside the host element.
 * Useful for closing menus, dropdowns, dialogs, and pickers.
 * 
 * Usage:
 * ```html
 * <div closeOnOutsideClick [isOpen]="menuOpen" (close)="menuOpen = false">
 *   <button>Menu</button>
 *   <div class="dropdown">...</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[closeOnOutsideClick]',
  standalone: true
})
export class CloseOnOutsideClickDirective {
  /**
   * Whether the element is currently open/visible.
   * When false, click detection is disabled.
   */
  @Input() isOpen = false;

  /**
   * Optional array of CSS selectors for elements that should be excluded
   * from triggering the close event (e.g., the trigger button).
   */
  @Input() excludeSelectors: string[] = [];

  /**
   * Emits when a click occurs outside the host element.
   */
  @Output() close = new EventEmitter<void>();

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isOpen) return;

    const clickedInside = this.elementRef.nativeElement.contains(event.target as Node);
    
    if (clickedInside) return;

    // Check if clicked on an excluded element
    const clickedOnExcluded = this.excludeSelectors.some(selector => {
      const target = event.target as HTMLElement;
      return target.closest(selector) !== null;
    });

    if (clickedOnExcluded) return;

    this.close.emit();
  }
}
