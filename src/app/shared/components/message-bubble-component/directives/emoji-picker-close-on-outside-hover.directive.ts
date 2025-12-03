import { Directive, ElementRef, HostListener, Input } from '@angular/core';
import { MessageInteractionService } from '../message-interaction.service';
import { MessageReactionService } from '../message-reaction.service';

@Directive({
  selector: '[appEmojiPickerCloseOnOutsideHoverDirective]',
})
export class EmojiPickerCloseOnOutsideHoverDirective {
  @Input() isPickerOpen = false;

  constructor(
    private interactionService: MessageInteractionService,
    public reactionService: MessageReactionService,
        public el: ElementRef<HTMLElement>,
  ) {}

  /**
   * Close pickers only when pointer leaves a padded area around the host (message-container).
   * Adds ~12px tolerance, and keeps open when hovering the emoji picker itself.
   */
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent) {
    if (!this.isPickerOpen) return;

    const refEl = this.getMessageContainerElement();
    const insidePadded = this.isMouseInsidePaddedArea(event, refEl);
    const overPicker = this.isMouseOverEmojiPicker(event);

    if (!insidePadded && !overPicker) {
      this.reactionService.closeEmojiPicker();
    }
  }

  /** Get the container element used as reference for pointer boundary checks. */
  private getMessageContainerElement() {
    const container = this.el.nativeElement.querySelector(
      '.message-container'
    ) as HTMLElement | null;
    const refEl = container ?? this.el.nativeElement;
    return refEl;
  }

  /** Check if the mouse is inside a padded area around the message container. */
  private isMouseInsidePaddedArea(event: MouseEvent, refEl: HTMLElement) {
    return this.interactionService.isMouseWithinPaddedArea(refEl, event.clientX, event.clientY);
  }

  /** Determine whether the mouse is currently over the emoji picker element. */
  private isMouseOverEmojiPicker(event: MouseEvent) {
    return this.interactionService.isElementOrAncestor(
      event.target as HTMLElement,
      '.emoji-picker-container'
    );
  }
}
