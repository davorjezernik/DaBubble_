import { Injectable, ElementRef } from '@angular/core';
import { fromEvent, merge, Observable, Subject } from 'rxjs';
import { map, distinctUntilChanged, debounceTime } from 'rxjs/operators';

/**
 * Service to manage complex user interaction patterns for message components.
 * Handles hover states, click outside detection, and mouse tolerance for emoji pickers.
 */
@Injectable()
export class MessageInteractionService {
  private hoverTolerance = 12; // pixels
  
  /**
   * Manages hover state for an element considering mobile vs desktop.
   * On desktop: shows on mouseenter, hides on mouseleave
   * On mobile: always returns false (tap behavior handled separately)
   * 
   * @param element The element to track hover state for
   * @param isMobile Whether the device is mobile
   * @returns Observable<boolean> that emits true when hovered, false when not
   */
  manageHoverState(element: ElementRef<HTMLElement>, isMobile: boolean): Observable<boolean> {
    if (isMobile) {
      // On mobile, hover is disabled (tap behavior used instead)
      return new Observable(observer => {
        observer.next(false);
        observer.complete();
      });
    }

    const mouseEnter$ = fromEvent(element.nativeElement, 'mouseenter').pipe(map(() => true));
    const mouseLeave$ = fromEvent(element.nativeElement, 'mouseleave').pipe(map(() => false));

    return merge(mouseEnter$, mouseLeave$).pipe(
      distinctUntilChanged()
    );
  }

  /**
   * Detects clicks outside of a given element.
   * Useful for closing menus, dialogs, and pickers.
   * 
   * @param element The element to check clicks against
   * @returns Observable<MouseEvent> that emits when a click occurs outside the element
   */
  detectClickOutside(element: ElementRef<HTMLElement>): Observable<MouseEvent> {
    return new Observable(observer => {
      const clickHandler = (event: MouseEvent) => {
        const clickedInside = element.nativeElement.contains(event.target as Node);
        if (!clickedInside) {
          observer.next(event);
        }
      };

      document.addEventListener('click', clickHandler);

      return () => {
        document.removeEventListener('click', clickHandler);
      };
    });
  }

  /**
   * Checks if mouse position is within a padded area around an element.
   * Used for emoji picker auto-close with tolerance to prevent accidental closes.
   * 
   * @param element The element to check proximity to
   * @param mouseX Current mouse X position
   * @param mouseY Current mouse Y position
   * @param padding Padding tolerance in pixels (default: 12)
   * @returns boolean - true if mouse is within padded area
   */
  isMouseWithinPaddedArea(
    element: HTMLElement,
    mouseX: number,
    mouseY: number,
    padding: number = this.hoverTolerance
  ): boolean {
    const rect = element.getBoundingClientRect();
    return (
      mouseX >= rect.left - padding &&
      mouseX <= rect.right + padding &&
      mouseY >= rect.top - padding &&
      mouseY <= rect.bottom + padding
    );
  }

  /**
   * Checks if an element or any of its parents match a selector.
   * Useful for determining if a click target is within a specific component.
   * 
   * @param target The element to check
   * @param selector CSS selector to match against
   * @returns boolean - true if target or ancestor matches selector
   */
  isElementOrAncestor(target: HTMLElement | null, selector: string): boolean {
    return !!target?.closest(selector);
  }

  /**
   * Creates an observable that emits when the mouse leaves a padded area.
   * Includes tolerance for emoji picker and menu interactions.
   * 
   * @param containerElement The container element to monitor
   * @param pickerSelector CSS selector for the picker element
   * @param padding Padding tolerance in pixels
   * @returns Observable<MouseEvent> that emits when mouse leaves the padded area
   */
  detectMouseLeaveWithTolerance(
    containerElement: ElementRef<HTMLElement>,
    pickerSelector: string = '.emoji-picker-container',
    padding: number = this.hoverTolerance
  ): Observable<MouseEvent> {
    return new Observable<MouseEvent>(observer => {
      const mouseMoveHandler = (event: MouseEvent) => {
        const container = containerElement.nativeElement.querySelector('.message-container') as HTMLElement | null;
        const refEl = container ?? containerElement.nativeElement;
        
        const insidePadded = this.isMouseWithinPaddedArea(refEl, event.clientX, event.clientY, padding);
        const overPicker = this.isElementOrAncestor(event.target as HTMLElement, pickerSelector);

        if (!insidePadded && !overPicker) {
          observer.next(event);
        }
      };

      document.addEventListener('mousemove', mouseMoveHandler);

      return () => {
        document.removeEventListener('mousemove', mouseMoveHandler);
      };
    }).pipe(
      debounceTime(50) // Prevent excessive emissions
    );
  }

  /**
   * Manages mobile tap toggle behavior for an element.
   * Returns an observable that emits the new state on each tap.
   * 
   * @param element The element to track taps on
   * @param currentState Current visibility state
   * @returns Observable<boolean> that emits toggled state
   */
  manageTapToggle(element: ElementRef<HTMLElement>, currentState: boolean): Observable<boolean> {
    return fromEvent(element.nativeElement, 'click').pipe(
      map(() => !currentState),
      distinctUntilChanged()
    );
  }

  /**
   * Checks if a mouseenter/leave event is actually leaving to a child element.
   * Prevents hiding UI when moving from parent to child.
   * 
   * @param event The mouse event
   * @param hostElement The host element
   * @returns boolean - true if moving to a child element
   */
  isMovingToChild(event: MouseEvent, hostElement: HTMLElement): boolean {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    return !!(relatedTarget && hostElement.contains(relatedTarget));
  }
}
