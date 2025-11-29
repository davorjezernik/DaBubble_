import { Directive, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Directive that emits an event when a click occurs outside the host element.
 */
@Directive({
  selector: '[closeOnOutsideClick]',
  standalone: true
})
export class CloseOnOutsideClickDirective {

  @Input() isOpen = false;
  @Input() excludeSelectors: string[] = [];
  @Output() close = new EventEmitter<void>();

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  /**
   * Handle document clicks and emit `close` when a click occurs outside the host.
   * @param event The click event from the document
   * Side effects: emits `close` when `isOpen` and click is outside host and not on an excluded selector
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isOpen) return;
    const clickedInside = this.elementRef.nativeElement.contains(event.target as Node);
    
    if (clickedInside) return;
    const clickedOnExcluded = this.excludeSelectors.some(selector => {
      const target = event.target as HTMLElement;
      return target.closest(selector) !== null;
    });

    if (clickedOnExcluded) return;
    this.close.emit();
  }
}
