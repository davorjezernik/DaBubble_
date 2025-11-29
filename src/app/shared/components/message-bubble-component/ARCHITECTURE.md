# MessageBubbleComponent Architecture

## Overview

The MessageBubbleComponent is a modular, feature-rich chat message component built with Angular 18+ standalone components. After comprehensive refactoring, it follows a clean separation of concerns with focused subcomponents, reusable services, and declarative directives.

**Main Component**: ~330 lines (orchestration layer)  
**Extracted Modules**: 4 subcomponents, 1 service, 2 directives, 1 utilities file

---

## Component Tree

```
MessageBubbleComponent (main orchestrator)
├── MessageEditModeComponent (edit functionality)
│   └── EmojiPickerComponent (emoji insertion during edit)
├── MessageMiniActionsComponent (hover/tap action bar)
│   └── More menu dropdown
├── MessageReactionsComponent (reactions display)
│   └── EmojiPickerComponent (add reactions)
├── ConfirmDeleteDialogComponent (delete confirmation)
└── Directives
    ├── closeOnOutsideClick (close menus on outside click)
    └── closeOnEscape (close on ESC key)
```

---

## Module Breakdown

### Main Component: `message-bubble.component.ts`

**Responsibility**: Orchestrate child components, handle top-level state, emit events to parent

**Lines**: ~330 (reduced from ~450)

**Key Features**:

- Message display (text, avatar, name, timestamp)
- State management (editing, deleting, emoji pickers)
- Event coordination (save, delete, thread navigation)
- Responsive viewport detection
- User profile card integration

**Inputs** (14):

```typescript
@Input() message!: Message;
@Input() userUID!: string;
@Input() isSender!: boolean;
@Input() collectionName!: 'channels' | 'dms';
@Input() chatId!: string;
@Input() isThreadView: boolean = false;
// ... viewport flags, etc.
```

**Outputs** (1):

```typescript
@Output() messageChanged = new EventEmitter<void>();
```

**Services Used** (7):

- `MessageLogicService` - Business logic
- `MessageReactionService` - Reaction handling
- `MessageInteractionService` - Interaction utilities
- `UserService` - User data
- `MatDialog` - Material dialog
- `ElementRef` - DOM access
- `Renderer2` - DOM manipulation

**Host Listeners** (2):

- `@HostListener('window:resize')` - Viewport detection
- `@HostListener('document:mousemove')` - Hover tolerance

---

### Subcomponent: `message-edit-mode.component.ts`

**Responsibility**: Handle inline message editing with emoji picker

**Lines**: 130

**Features**:

- Textarea auto-sizing
- Emoji picker integration
- Character input handling
- Save/cancel actions

**Interface**:

```typescript
@Input() text: string = '';
@Input() isSaving: boolean = false;
@Output() save = new EventEmitter<string>();
@Output() cancel = new EventEmitter<void>();
```

**Template**: 30 lines  
**Styles**: 140 lines (responsive media queries for emoji picker positioning)

**Key Behaviors**:

- Auto-expand textarea on input
- Emoji insertion at cursor position
- Disabled state during save
- Escape/click outside to cancel (via parent directives)

---

### Subcomponent: `message-mini-actions.component.ts`

**Responsibility**: Display hover/tap action bar with quick actions

**Lines**: ~100

**Features**:

- Quick reactions (✅, 👍)
- Add reaction button
- Comment/thread button
- Edit/delete buttons (conditional)
- More menu dropdown

**Interface**:

```typescript
@Input() visible: boolean = false;
@Input() isThreadView: boolean = false;
@Input() isOutgoing: boolean = false;
@Input() isDeleting: boolean = false;
@Output() quickReact = new EventEmitter<string>();
@Output() addReaction = new EventEmitter<void>();
@Output() comment = new EventEmitter<void>();
@Output() edit = new EventEmitter<void>();
@Output() delete = new EventEmitter<void>();
```

**Template**: ~60 lines  
**Styles**: ~150 lines (hover effects, positioning, dropdown menu)

**Conditional Logic**:

- Hide edit/delete buttons in thread view
- Show only in outgoing messages (sender's messages)
- Toggle more menu with outside click detection

---

### Subcomponent: `message-reactions.component.ts`

**Responsibility**: Display reaction chips with expand/collapse and tooltips

**Lines**: 119

**Features**:

- Reaction chips with count
- Tooltip on hover (desktop)
- Expand/collapse for many reactions
- Add reaction button with emoji picker
- Responsive collapse thresholds

**Interface**:

```typescript
@Input() reactions: MessageReaction[] = [];
@Input() isNarrow: boolean = false;
@Input() isVeryNarrow: boolean = false;
@Input() isMobile: boolean = false;
@Input() showEmojiPicker: boolean = false;
@Output() reactionClick = new EventEmitter<string>();
@Output() emojiSelected = new EventEmitter<string>();
@Output() toggleEmojiPicker = new EventEmitter<void>();
@Output() closeEmojiPicker = new EventEmitter<void>();
```

**Template**: 71 lines  
**Styles**: 191 lines (chip styling, tooltips, responsive collapse)

**Computed Properties**:

```typescript
visibleReactions: MessageReaction[]  // Collapsed subset
hasMore: boolean                      // Has hidden reactions
moreCount: number                     // Count of hidden
shouldCenterNarrow: boolean           // Center alignment logic
getCollapseThreshold(): number        // Responsive threshold
```

**Exported Interface**:

```typescript
export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  currentUserReacted: boolean;
}
```

---

### Service: `message-interaction.service.ts`

**Responsibility**: Reusable utilities for interaction patterns

**Lines**: 174

**Injectable**: `{ providedIn: 'root' }`

**Methods**:

```typescript
// Observable-based hover state management
manageHoverState(element: HTMLElement, isMobile: boolean): Observable<boolean>

// Click outside detection
detectClickOutside(element: HTMLElement): Observable<MouseEvent>

// Mouse proximity check (12px tolerance)
isMouseWithinPaddedArea(mouseX: number, mouseY: number, element: HTMLElement, padding: number): boolean

// Selector matching utility
isElementOrAncestor(target: EventTarget | null, selector: string): boolean

// Observable mouse leave with debounce
detectMouseLeaveWithTolerance(element: HTMLElement, paddingPx: number): Observable<MouseEvent>

// Detect if mouse is moving to child element
isMovingToChild(event: MouseEvent, parentElement: HTMLElement): boolean
```

**Usage Example**:

```typescript
// In component
this.interactionService
  .manageHoverState(this.messageElement, this.isMobile)
  .pipe(takeUntil(this.destroy$))
  .subscribe((isHovered) => {
    this.showMiniActions = isHovered;
  });
```

**Key Features**:

- RxJS-based reactive patterns
- Configurable tolerance/padding
- Mobile vs desktop behavior
- Reusable across components

---

### Directive: `close-on-outside-click.directive.ts`

**Responsibility**: Close element on outside click

**Lines**: 56

**Selector**: `[closeOnOutsideClick]`

**Interface**:

```typescript
@Input() isOpen: boolean = false;
@Input() excludeSelectors: string[] = [];
@Output() close = new EventEmitter<void>();
```

**Usage**:

```html
<div
  class="more-menu"
  [closeOnOutsideClick]
  [isOpen]="isMoreMenuOpen"
  [excludeSelectors]="['.more-icon']"
  (close)="onCloseMoreMenu()"
>
  <!-- menu content -->
</div>
```

**Behavior**:

- Listens to `document:click`
- Checks if click is outside element
- Respects excluded selectors (e.g., trigger buttons)
- Only emits when `isOpen` is true

---

### Directive: `close-on-escape.directive.ts`

**Responsibility**: Close element on ESC key

**Lines**: 36

**Selector**: `[closeOnEscape]`

**Interface**:

```typescript
@Input() isOpen: boolean = false;
@Output() close = new EventEmitter<void>();
```

**Usage**:

```html
<div
  class="message-container"
  [closeOnEscape]
  [isOpen]="isEditing || showEmojiPicker"
  (close)="onEscapePressed()"
>
  <!-- message content -->
</div>
```

**Behavior**:

- Listens to `document:keydown.escape`
- Only emits when `isOpen` is true
- Generic reusable pattern

---

### Utilities: `message-bubble.utils.ts`

**Responsibility**: Pure functions for common calculations

**Lines**: ~40

**Exports**:

```typescript
// Constants
export const DELETED_PLACEHOLDER = 'Nachricht wurde gelöscht';
export const MAX_UNIQUE_REACTIONS = 5;

// Viewport detection
export function isNarrowViewport(width: number): boolean;
export function isVeryNarrowViewport(width: number): boolean;
export function isMobileViewport(width: number): boolean;

// Timestamp normalization
export function normalizeTimestamp(value: unknown): Date | null;
```

**Breakpoints**:

- Mobile: ≤ 500px
- Very Narrow: ≤ 400px
- Narrow: ≤ 450px

**Usage**:

```typescript
this.isNarrow = isNarrowViewport(window.innerWidth);
this.timestamp = normalizeTimestamp(message.createdAt);
```

---

## Data Flow

### Parent → MessageBubble

```
Parent Component
  ↓ @Input() message
  ↓ @Input() userUID
  ↓ @Input() isSender
MessageBubbleComponent
```

### MessageBubble → Children

```
MessageBubbleComponent
  ↓ @Input() text, isSaving
MessageEditModeComponent
  ↑ @Output() save, cancel

MessageBubbleComponent
  ↓ @Input() visible, isThreadView
MessageMiniActionsComponent
  ↑ @Output() quickReact, edit, delete

MessageBubbleComponent
  ↓ @Input() reactions, viewport flags
MessageReactionsComponent
  ↑ @Output() reactionClick, emojiSelected
```

### Event Propagation

```
User clicks reaction chip
  ↓
MessageReactionsComponent.reactionClick.emit(emoji)
  ↓
MessageBubbleComponent.onReactionToggle(emoji)
  ↓
MessageReactionService.toggleReaction()
  ↓
Firestore update
  ↓
Parent component detects change
  ↓
Re-renders with updated reactions
```

---

## State Management

### Local State (MessageBubbleComponent)

```typescript
// UI State
showEmojiPicker: boolean = false;
reactionsExpanded: boolean = false;
isMoreMenuOpen: boolean = false;
showMiniActions: boolean = false;
tooltipVisibleForEmoji: string | null = null;

// Operation State
isEditing: boolean = false;
isSaving: boolean = false;
isDeleting: boolean = false;

// Viewport State
innerWidth: number = window.innerWidth;
isNarrow: boolean = false;
isVeryNarrow: boolean = false;
isMobile: boolean = false;

// Computed State
isOutgoing: boolean (get)
isIncoming: boolean (get)
isDeleted: boolean (get)
```

### Child Component State

**MessageEditModeComponent**:

```typescript
editText: string = '';
editEmojiPickerVisible: boolean = false;
```

**MessageReactionsComponent**:

```typescript
showMore: boolean = false;
tooltipVisibleForEmoji: string | null = null;
```

**MessageMiniActionsComponent**:

```typescript
isMoreMenuOpen: boolean = false;
```

### Service State (MessageInteractionService)

Stateless - provides utilities only, no state management

---

## Styling Architecture

### Component Styles (Encapsulated)

Each component has its own `.scss` file with ViewEncapsulation default:

- `message-bubble.component.scss` - Main layout, incoming/outgoing styles
- `message-edit-mode.component.scss` - Edit mode, responsive emoji picker positioning
- `message-mini-actions.component.scss` - Action bar, hover effects, dropdown menu
- `message-reactions.component.scss` - Reaction chips, tooltips, expand/collapse

### Cross-Component Styling

When parent needs to style child elements (e.g., incoming messages):

```scss
// In message-bubble.component.scss
&.incoming {
  ::ng-deep .reaction-chip {
    // Override child component styles
  }
}
```

### Responsive Patterns

Media queries in child components:

```scss
// message-edit-mode.component.scss
@media (max-width: 450px) {
  .emoji-picker-container {
    left: 0 !important; // Override ::ng-deep styles
  }
}
```

---

## Event Handling

### Desktop Interactions

1. **Hover to show mini-actions**:

   - `onSpeechBubbleEnter()` → `showMiniActions = true`
   - `onSpeechBubbleLeave()` → `showMiniActions = false` (with tolerance)

2. **Click reaction chip**:

   - `MessageReactionsComponent.reactionClick.emit(emoji)`
   - `onReactionToggle(emoji)` → Service call

3. **Edit message**:
   - `MessageMiniActionsComponent.edit.emit()`
   - `onEditMessage()` → `isEditing = true`
   - `MessageEditModeComponent.save.emit(text)`
   - `saveEdit(text)` → Service call

### Mobile Interactions

1. **Tap to toggle mini-actions**:

   - `onMessageClick()` → `showMiniActions = !showMiniActions`

2. **Tap outside to close**:
   - `closeOnOutsideClick` directive → `close.emit()`
   - `onCloseMoreMenu()` → `isMoreMenuOpen = false`

### Keyboard Interactions

1. **ESC to close**:
   - `closeOnEscape` directive → `close.emit()`
   - `onEscapePressed()` → Close all open menus/pickers

---

## Firestore Integration

### Read Operations

```typescript
// Load reactions
MessageReactionService.getReactions(chatId, messageId, collectionName)
  → Subscribe to reactions snapshot
  → Update local reactions array

// Load thread answers count (if implemented)
getAnswersInfo()
  → Subscribe to thread messages
  → Update answersCount, lastTime
```

### Write Operations

```typescript
// Toggle reaction
MessageReactionService.toggleReaction(emoji, chatId, messageId, collectionName, userUID)
  → Add/remove reaction in Firestore
  → Emit messageChanged event

// Save edited message
MessageLogicService.editMessage(messageId, newText, chatId, collectionName)
  → Update message document
  → Emit messageChanged event

// Delete message
MessageLogicService.confirmDelete(messageId, chatId, collectionName)
  → Soft delete (set isDeleted flag)
  → Remove all reactions
  → Emit messageChanged event
```

---

## Performance Considerations

### Optimizations

- **OnPush Change Detection**: Not yet implemented (future optimization)
- **ViewChild References**: Minimal usage (only for edit textarea auto-sizing)
- **Unsubscribe Pattern**: `takeUntil(destroy$)` for all observables
- **Event Debouncing**: Mouse leave events debounced (50ms)

### Bundle Size

- Main component: ~330 lines (reduced from ~450)
- Total extracted code: ~390 lines in subcomponents/services
- No bundle size increase (code redistribution, not addition)

### Memory Management

```typescript
private destroy$ = new Subject<void>();

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
```

All subscriptions use `.pipe(takeUntil(this.destroy$))` to prevent leaks.

---

## Testing Strategy

### Unit Testing

**Utilities** (Pure Functions):

```typescript
describe('isNarrowViewport', () => {
  it('should return true for width <= 450px', () => {
    expect(isNarrowViewport(400)).toBe(true);
    expect(isNarrowViewport(500)).toBe(false);
  });
});
```

**Components** (Isolated):

```typescript
describe('MessageEditModeComponent', () => {
  it('should emit save event with text', () => {
    spyOn(component.save, 'emit');
    component.onSave();
    expect(component.save.emit).toHaveBeenCalledWith('test text');
  });
});
```

**Services**:

```typescript
describe('MessageInteractionService', () => {
  it('should detect click outside element', () => {
    const mockElement = document.createElement('div');
    const click$ = service.detectClickOutside(mockElement);
    // Test observable emissions
  });
});
```

### Integration Testing

Manual testing checklist (see refactor-plan.md):

- Message display
- Reactions (add/remove)
- Edit mode (save/cancel)
- Delete confirmation
- Thread navigation
- Responsive breakpoints
- User profile card

---

## Future Enhancements

### Potential Improvements (Not in Current Scope)

1. **Angular Signals**: Replace BehaviorSubject with signals
2. **OnPush Change Detection**: Improve performance
3. **Virtual Scrolling**: For many reactions
4. **Unit Tests**: Comprehensive test coverage
5. **Accessibility**: ARIA labels, keyboard navigation
6. **Internationalization**: Multi-language support
7. **Animation**: Smooth transitions for expand/collapse
8. **Thread Info Subcomponent**: Extract Phase 5 (currently in main component)

---

## Dependencies

### Angular Core

- `@angular/core`: Component, Directive, Injectable decorators
- `@angular/common`: CommonModule, date pipes

### Material UI

- `@angular/material/dialog`: Dialog service, confirm delete

### Firebase

- `@angular/fire/firestore`: Firestore service

### Custom Services

- `MessageLogicService`
- `MessageReactionService`
- `MessageInteractionService`
- `UserService`

### Custom Components

- `EmojiPickerComponent`
- `ConfirmDeleteDialogComponent`

---

## File Structure

```
message-bubble-component/
├── message-bubble.component.ts          (330 lines - main orchestrator)
├── message-bubble.component.html        (structure, subcomponent usage)
├── message-bubble.component.scss        (main styling, ::ng-deep overrides)
├── message-bubble.utils.ts              (40 lines - pure utilities)
├── ARCHITECTURE.md                      (this file)
├── refactor-plan.md                     (refactoring documentation)
│
├── message-edit-mode/
│   ├── message-edit-mode.component.ts   (130 lines)
│   ├── message-edit-mode.component.html (30 lines)
│   └── message-edit-mode.component.scss (140 lines)
│
├── message-mini-actions/
│   ├── message-mini-actions.component.ts   (~100 lines)
│   ├── message-mini-actions.component.html (~60 lines)
│   └── message-mini-actions.component.scss (~150 lines)
│
├── message-reactions/
│   ├── message-reactions.component.ts   (119 lines)
│   ├── message-reactions.component.html (71 lines)
│   └── message-reactions.component.scss (191 lines)
│
├── confirm-delete-dialog.component.ts   (existing)
├── confirm-delete-dialog.component.scss (existing)
├── message-logic.service.ts             (existing)
├── message-reaction.service.ts          (existing)
├── message-interaction.service.ts       (174 lines - NEW)
│
└── directives/
    ├── close-on-outside-click.directive.ts (56 lines)
    └── close-on-escape.directive.ts        (36 lines)
```

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Refactoring Status**: Complete (Phases 1-4, 6, 8, 10 executed)
