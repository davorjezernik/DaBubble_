# Message Bubble Component Refactoring Plan

## Overview

This document outlines a step-by-step plan to refactor the `MessageBubbleComponent` from a large monolithic structure into a modular, maintainable architecture while preserving all existing functionalities and styles.

**Current State**: 450+ lines in a single component file  
**Goal**: Break down into focused, testable modules  
**Approach**: Incremental refactoring with manual testing between steps

---

## Analysis of Current Structure

### Component Responsibilities (Too Many)

The component currently handles:

1. **Message Display** - Rendering message content, avatar, name, timestamp
2. **Reaction Management** - Adding, removing, displaying reactions
3. **Edit Mode** - Inline editing with textarea and emoji picker
4. **Delete Operations** - Confirmation dialog and soft delete
5. **Thread Navigation** - Opening thread panel and displaying thread info
6. **Mini Actions Bar** - Hover/tap menu with quick actions
7. **Emoji Pickers** - Two separate pickers (reactions + edit mode)
8. **User Interactions** - Click, hover, keyboard handlers
9. **Responsive Behavior** - Breakpoint detection and adaptation
10. **Firestore Integration** - Loading thread answers data
11. **User Profile** - Opening user card dialog
12. **Tooltip Management** - Reaction chip tooltips

### Code Metrics

- **Lines of Code**: ~450
- **Public Methods**: 30+
- **Private Methods**: 6+
- **Host Listeners**: 5
- **ViewChild References**: 3
- **Input Properties**: 14
- **Output Properties**: 1
- **Dependencies**: 9 services/components

### Problems Identified

1. **Single Responsibility Violation**: Component does too many things
2. **Testing Difficulty**: Hard to unit test individual features
3. **Code Readability**: Long file requires excessive scrolling
4. **Tight Coupling**: UI logic mixed with business logic
5. **Duplication**: Similar patterns for emoji pickers, hover states
6. **State Management**: Too many local boolean flags

---

## Refactoring Strategy

### Principles

- ✅ **Preserve All Functionality** - No feature removal
- ✅ **Preserve All Styles** - No visual changes
- ✅ **Incremental Changes** - One module at a time
- ✅ **Manual Testing** - Verify after each step
- ✅ **Backward Compatible** - No breaking changes to parent components
- ❌ **No New Features** - Focus on restructuring only
- ❌ **No Fallback Solutions** - Keep existing behavior

### Modularization Approach

Extract responsibilities into:

1. **Presentational Components** - Pure UI display
2. **Container Components** - Logic orchestration
3. **Services** - Shared business logic (already started)
4. **Utility Functions** - Pure helper functions
5. **Directives** - Reusable behaviors

---

## Refactoring Steps

### Phase 1: Extract Utility Functions

**Goal**: Remove pure functions from component into utility file

**Files to Create**:

- `message-bubble.utils.ts`

**Functions to Extract**:

```typescript
// Viewport detection
- isNarrowViewport(width: number): boolean
- isVeryNarrowViewport(width: number): boolean
- isMobileViewport(width: number): boolean

// Timestamp normalization
- normalizeTimestamp(value: unknown): Date | null

// Constants
- DELETED_PLACEHOLDER
- MAX_UNIQUE_REACTIONS
- DEFAULT_COLLAPSE_THRESHOLD
- NARROW_COLLAPSE_THRESHOLD
- VERY_NARROW_COLLAPSE_THRESHOLD
```

**Impact**: Reduces component by ~40 lines

**Testing Required**:

- Verify responsive breakpoints still work
- Check timestamp display in various formats

---

### Phase 2: Extract Edit Mode into Subcomponent

**Goal**: Isolate edit functionality into dedicated component

**Files to Create**:

- `message-edit-mode/message-edit-mode.component.ts`
- `message-edit-mode/message-edit-mode.component.html`
- `message-edit-mode/message-edit-mode.component.scss`

**Component Interface**:

```typescript
@Input() text: string;
@Input() isSaving: boolean;
@Output() save = new EventEmitter<string>();
@Output() cancel = new EventEmitter<void>();
```

**Extracted Methods**:

- `onEditInput()`
- `onEditEmojiSelected()`
- `autosizeEditTextarea()`
- Edit emoji picker toggle logic

**Extracted Template**:

- `.edit-container` section from main template

**Extracted Styles**:

- `.edit-container`, `.edit-textarea`, `.edit-actions` styles

**Impact**: Reduces component by ~80 lines

**Testing Required**:

- Edit message and verify text updates
- Insert emoji during edit
- Save edited message
- Cancel edit
- Verify textarea auto-sizing
- Check emoji picker positioning

---

### Phase 3: Extract Mini Actions into Subcomponent

**Goal**: Separate action bar into reusable component

**Files to Create**:

- `message-mini-actions/message-mini-actions.component.ts`
- `message-mini-actions/message-mini-actions.component.html`
- `message-mini-actions/message-mini-actions.component.scss`

**Component Interface**:

```typescript
@Input() visible: boolean;
@Input() isThreadView: boolean;
@Input() isOutgoing: boolean;
@Input() isDeleting: boolean;
@Output() quickReact = new EventEmitter<string>();
@Output() addReaction = new EventEmitter<void>();
@Output() comment = new EventEmitter<void>();
@Output() edit = new EventEmitter<void>();
@Output() delete = new EventEmitter<void>();
```

**Extracted Methods**:

- `onQuickReact()`
- `onMiniAddReactionClick()`
- `toggleMoreMenu()`
- `onEditMessage()`
- `openConfirmDelete()`

**Extracted Template**:

- `.mini-actions` section

**Extracted Styles**:

- `.mini-actions`, `.mini-emoji`, `.mini-icon`, `.more-menu`, `.menu-dropdown` styles

**Impact**: Reduces component by ~100 lines

**Testing Required**:

- Quick react (✅, 👍)
- Open reaction picker
- Open thread
- Edit message
- Delete message
- More menu toggle
- Hover/tap interactions
- Desktop vs mobile behavior

---

### Phase 4: Extract Reactions Display into Subcomponent

**Goal**: Move reaction chips into dedicated component

**Files to Create**:

- `message-reactions/message-reactions.component.ts`
- `message-reactions/message-reactions.component.html`
- `message-reactions/message-reactions.component.scss`

**Component Interface**:

```typescript
@Input() reactions: MessageReaction[];
@Input() isNarrow: boolean;
@Input() isVeryNarrow: boolean;
@Input() isMobile: boolean;
@Input() maxReactions: number;
@Input() isDeleted: boolean;
@Output() reactionClick = new EventEmitter<string>();
@Output() emojiSelected = new EventEmitter<string>();
```

**Extracted Methods**:

- `onReactionChipClick()`
- `onReactionChipEnter()`
- `onReactionChipLeave()`
- `showMore()`
- `showLess()`

**Extracted Computed Properties**:

- `visibleReactions`
- `hasMore`
- `moreCount`
- `shouldCenterNarrow`
- `getCollapseThreshold()`

**Extracted Template**:

- `.reactions` section

**Extracted Styles**:

- `.reactions`, `.reaction-chip`, `.reaction-tooltip` styles

**Impact**: Reduces component by ~120 lines

**Testing Required**:

- Click reaction to toggle
- Hover to see tooltip
- Expand/collapse reactions
- Add new reaction via picker
- Verify responsive thresholds
- Check tooltip positioning

---

### Phase 5: Extract Thread Info into Subcomponent

**Goal**: Separate thread answers display

**Files to Create**:

- `message-thread-info/message-thread-info.component.ts`
- `message-thread-info/message-thread-info.component.html`
- `message-thread-info/message-thread-info.component.scss`

**Component Interface**:

```typescript
@Input() chatId: string;
@Input() messageId: string;
@Input() collectionName: 'channels' | 'dms';
@Output() openThread = new EventEmitter<void>();
```

**Extracted Methods**:

- `getAnswersInfo()`
- `getAnswersAmount()`
- `getLastAnswerTime()`

**Extracted Properties**:

- `answersCount`
- `lastTime`
- `answersCountSub`
- `lastTimeSub`

**Extracted Template**:

- `.answers-info` section

**Extracted Styles**:

- `.answers-info`, `.answers-amount`, `.last-answer-time` styles

**Impact**: Reduces component by ~60 lines

**Testing Required**:

- Verify answers count updates
- Check last answer timestamp
- Click to open thread
- Test with no answers
- Test with multiple answers

---

### Phase 6: Create Interaction Handler Service

**Goal**: Move complex interaction logic to service

**Files to Create**:

- `message-interaction.service.ts`

**Service Responsibilities**:

```typescript
// Hover state management
manageHoverState(element: HTMLElement, isMobile: boolean): Observable<boolean>

// Click outside detection
detectClickOutside(element: HTMLElement): Observable<MouseEvent>

// Emoji picker positioning
calculatePickerPosition(trigger: HTMLElement, picker: HTMLElement): Position

// Tooltip visibility
manageTooltipVisibility(emoji: string | null): void
```

**Extracted Logic**:

- `onSpeechBubbleEnter()`
- `onSpeechBubbleLeave()`
- `onMiniActionsEnter()`
- `onMiniActionsLeave()`
- `onMessageClick()`
- Hover tolerance logic from `onDocumentMouseMove()`

**Impact**: Reduces component by ~70 lines

**Testing Required**:

- Hover to show mini actions
- Leave message to hide actions
- Mobile tap behavior
- Tooltip show/hide
- Click outside detection

---

### Phase 7: Consolidate State Management

**Goal**: Group related state into cohesive objects

**Current State Variables** (9 booleans):

```typescript
showEmojiPicker;
reactionsExpanded;
isMoreMenuOpen;
showMiniActions;
isEditing;
isSaving;
isDeleting;
editEmojiPickerVisible;
tooltipVisibleForEmoji;
```

**Refactored State Objects**:

```typescript
// UI State
uiState = {
  showEmojiPicker: false,
  showMiniActions: false,
  isMoreMenuOpen: false,
  tooltipEmoji: null as string | null,
};

// Edit State
editState = {
  isEditing: false,
  isSaving: false,
  text: '',
  showEmojiPicker: false,
};

// Operation State
operationState = {
  isDeleting: false,
};

// Reaction State (managed by service)
reactionState = {
  expanded: false,
};
```

**Impact**: Improves code organization, reduces boolean proliferation

**Testing Required**:

- All state transitions work correctly
- No regressions in UI behavior

---

### Phase 8: Extract Document Event Handlers into Directive

**Goal**: Create reusable directive for global listeners

**Files to Create**:

- `directives/close-on-outside-click.directive.ts`
- `directives/close-on-escape.directive.ts`

**Directive Interface**:

```typescript
@Directive({
  selector: '[closeOnOutsideClick]',
})
export class CloseOnOutsideClickDirective {
  @Input() isOpen: boolean;
  @Input() excludeElements: HTMLElement[];
  @Output() close = new EventEmitter<void>();
}
```

**Extracted Handlers**:

- `@HostListener('document:click')`
- `@HostListener('document:keydown.escape')`
- `@HostListener('document:mousemove')`

**Impact**: Reduces component by ~50 lines, improves reusability

**Testing Required**:

- Click outside to close menus
- ESC key to close
- Mouse leave tolerance
- Multiple open elements

---

### Phase 9: Simplify Component Template

**Goal**: Clean up template with structural refactoring

**Changes**:

- Replace long conditional chains with `ng-container` + `*ngIf`
- Extract repeated attribute sets into variables
- Use `@if` control flow consistently
- Simplify class binding expressions

**Example**:

```html
<!-- Before -->
<div
  class="reaction-chip"
  [class.reacted]="r.currentUserReacted"
  [class.show-tooltip]="tooltipVisibleForEmoji === r.emoji"
  (click)="onReactionChipClick(r.emoji)"
  (mouseenter)="onReactionChipEnter(r.emoji)"
  (mouseleave)="onReactionChipLeave()"
>
  <!-- After -->
  <div
    class="reaction-chip"
    [class]="getReactionChipClasses(r)"
    (click)="onReactionClick(r.emoji)"
    (mouseenter)="showReactionTooltip(r.emoji)"
    (mouseleave)="hideReactionTooltip()"
  ></div>
</div>
```

**Impact**: Improves template readability

**Testing Required**:

- Visual regression testing
- All interactions still work

---

### Phase 10: Final Cleanup and Documentation

**Goal**: Polish refactored code

**Tasks**:

1. Remove unused imports
2. Add JSDoc comments to new components/services
3. Update component.md with new structure
4. Add unit tests for extracted utilities
5. Verify no console errors
6. Check for memory leaks (unsubscribed observables)

**Files to Update**:

- `component.md` - Update architecture section
- `README.md` - Add new component tree

**Impact**: Production-ready refactored code

---

## New File Structure (After Refactoring)

```
message-bubble-component/
├── message-bubble.component.ts          (~150 lines, orchestration only)
├── message-bubble.component.html        (~80 lines, structure only)
├── message-bubble.component.scss        (unchanged, uses component styles)
├── message-bubble.utils.ts              (NEW - 40 lines)
├── message-logic.service.ts             (existing)
├── message-reaction.service.ts          (existing)
├── message-interaction.service.ts       (NEW - 80 lines)
├── confirm-delete-dialog.component.ts   (existing)
├── confirm-delete-dialog.component.scss (existing)
├── component.md                         (updated)
├── refactor-plan.md                     (this file)
│
├── message-edit-mode/
│   ├── message-edit-mode.component.ts
│   ├── message-edit-mode.component.html
│   └── message-edit-mode.component.scss
│
├── message-mini-actions/
│   ├── message-mini-actions.component.ts
│   ├── message-mini-actions.component.html
│   └── message-mini-actions.component.scss
│
├── message-reactions/
│   ├── message-reactions.component.ts
│   ├── message-reactions.component.html
│   └── message-reactions.component.scss
│
├── message-thread-info/
│   ├── message-thread-info.component.ts
│   ├── message-thread-info.component.html
│   └── message-thread-info.component.scss
│
└── directives/
    ├── close-on-outside-click.directive.ts
    └── close-on-escape.directive.ts
```

---

## Testing Strategy Between Steps

### Manual Testing Checklist (Run After Each Phase)

#### Core Message Display

- [ ] Message renders with correct text
- [ ] Avatar displays correctly
- [ ] Name and timestamp shown
- [ ] Incoming vs outgoing styling correct
- [ ] Deleted message styling correct
- [ ] Edited badge appears when edited

#### Reactions

- [ ] Reactions display correctly
- [ ] Click reaction to add/remove
- [ ] Tooltip shows on hover (desktop)
- [ ] Quick reactions (✅, 👍) work
- [ ] Add reaction picker opens
- [ ] Emoji picker adds reaction
- [ ] Reactions collapse/expand
- [ ] Responsive thresholds correct

#### Edit Mode

- [ ] Click edit opens edit mode
- [ ] Textarea auto-sizes
- [ ] Type text updates buffer
- [ ] Emoji picker inserts emoji
- [ ] Save updates message
- [ ] Cancel discards changes
- [ ] Loading state during save

#### Delete

- [ ] Click delete opens dialog
- [ ] Cancel closes dialog
- [ ] Confirm deletes message
- [ ] Soft delete shows placeholder
- [ ] Reactions removed after delete

#### Thread

- [ ] Answers count displays
- [ ] Last answer time correct
- [ ] Click opens thread panel
- [ ] Comment icon opens thread

#### Interactions

- [ ] Hover shows mini actions (desktop)
- [ ] Tap toggles mini actions (mobile)
- [ ] Click outside closes menus
- [ ] ESC closes pickers/menus
- [ ] Mouse leave closes pickers

#### Responsive

- [ ] Desktop layout (> 768px)
- [ ] Tablet layout (768px)
- [ ] Mobile layout (500px)
- [ ] Narrow layout (450px)
- [ ] Very narrow layout (400px)
- [ ] Landscape mode

#### User Profile

- [ ] Click name opens user card
- [ ] User card displays correctly

---

## Risk Assessment

### Low Risk Steps

- Phase 1: Utility extraction (pure functions)
- Phase 10: Documentation updates

### Medium Risk Steps

- Phase 5: Thread info (Firestore subscriptions)
- Phase 7: State consolidation (careful with refs)
- Phase 9: Template simplification (visual changes)

### High Risk Steps

- Phase 2: Edit mode (complex state)
- Phase 3: Mini actions (many interactions)
- Phase 4: Reactions (core feature)
- Phase 6: Interaction service (event handlers)
- Phase 8: Directive extraction (global listeners)

### Mitigation Strategies

1. **Git Commits**: Commit after each successful phase
2. **Feature Branches**: Create branch per phase for easy rollback
3. **Manual Testing**: Full checklist after each phase
4. **Console Monitoring**: Watch for errors/warnings
5. **Chrome DevTools**: Check for memory leaks
6. **Comparison Testing**: Side-by-side with original

---

## Rollback Plan

If any phase introduces bugs:

1. **Immediate**: Revert the phase's changes via Git
2. **Investigate**: Identify what broke
3. **Fix**: Adjust refactoring approach
4. **Re-test**: Verify fix works
5. **Continue**: Proceed to next phase

### Git Strategy

```bash
# Before each phase
git checkout -b refactor/phase-N-description

# After successful testing
git checkout feature/message-bubble
git merge refactor/phase-N-description
git push

# If problems
git checkout feature/message-bubble
git branch -D refactor/phase-N-description
```

---

## Success Criteria

### Quantitative Metrics

- ✅ Main component < 200 lines (from ~450)
- ✅ No file > 250 lines
- ✅ Max function length: 20 lines
- ✅ Cyclomatic complexity < 10 per function
- ✅ Test coverage > 80% for new utilities

### Qualitative Metrics

- ✅ Each component has single responsibility
- ✅ Easy to locate specific functionality
- ✅ New developer can understand structure in < 10 minutes
- ✅ No visual regressions
- ✅ No functional regressions
- ✅ Improved maintainability

---

## Timeline Estimate

Assuming ~2-3 hours per phase including testing:

- **Phase 1**: 2 hours (simple extraction)
- **Phase 2**: 4 hours (complex component)
- **Phase 3**: 4 hours (many interactions)
- **Phase 4**: 4 hours (core feature)
- **Phase 5**: 3 hours (Firestore logic)
- **Phase 6**: 4 hours (service extraction)
- **Phase 7**: 3 hours (state refactoring)
- **Phase 8**: 3 hours (directive creation)
- **Phase 9**: 2 hours (template cleanup)
- **Phase 10**: 2 hours (polish)

**Total**: ~31 hours over multiple sessions

---

## Notes and Considerations

### Preserve These Patterns

- Standalone component architecture
- Service injection for shared logic
- BehaviorSubject pattern for reactive state
- ViewChild references for DOM access
- HostListener for global events

### Don't Break These

- Parent component's `@Input` bindings
- Event emitter contracts
- Service API signatures
- CSS class names (for external overrides)
- Firestore document paths

### Future Optimization (Not in This Refactor)

- Replace BehaviorSubject with Angular Signals
- Add OnPush change detection
- Implement virtual scrolling for reactions
- Add unit tests (separate effort)
- Internationalization

---

## Execution Sequence

1. ✅ Read and approve this refactor plan
2. ✅ Create feature branch `refactor/message-bubble-modular`
3. Execute Phase 1 → Test → Commit
4. ✅ **Execute Phase 2 → Test → Commit** (COMPLETED)
5. Execute Phase 3 → Test → Commit
6. Execute Phase 4 → Test → Commit
7. Execute Phase 5 → Test → Commit
8. Execute Phase 6 → Test → Commit
9. Execute Phase 7 → Test → Commit
10. Execute Phase 8 → Test → Commit
11. Execute Phase 9 → Test → Commit
12. Execute Phase 10 → Test → Commit
13. Final integration testing
14. Merge to main branch

---

## Questions for Review

Before starting refactoring:

1. **Scope**: Is this refactoring plan aligned with project goals?
2. **Timeline**: Is ~31 hours acceptable for this refactoring?
3. **Priorities**: Should any phases be done before others?
4. **Risks**: Any concerns about specific phases?
5. **Testing**: Is manual testing sufficient or need automated tests first?
6. **Deployment**: Can this be deployed incrementally or needs full completion?

---

_This refactoring plan is a living document. Update as needed during execution._

**Status**: 🟡 Phase 2 Complete - Ready for Testing  
**Last Updated**: November 24, 2025  
**Author**: Development Team

---

## Phase 2 Completion Notes

### Files Created:

- ✅ `message-edit-mode/message-edit-mode.component.ts` (130 lines)
- ✅ `message-edit-mode/message-edit-mode.component.html` (30 lines)
- ✅ `message-edit-mode/message-edit-mode.component.scss` (140 lines)

### Files Modified:

- ✅ `message-bubble.component.ts` - Removed ~80 lines of edit logic
- ✅ `message-bubble.component.html` - Replaced edit template with subcomponent
- ✅ `message-bubble.component.scss` - Removed ~120 lines of edit styles

### Changes Summary:

- Extracted edit mode functionality into standalone subcomponent
- Removed ViewChild references for edit elements
- Removed `editText`, `editEmojiPickerVisible` properties
- Removed `onEditInput()`, `onEditEmojiSelected()`, `autosizeEditTextarea()` methods
- Updated `saveEdit()` to accept text parameter from subcomponent
- Subcomponent manages its own emoji picker and textarea state
- All edit styles moved to subcomponent SCSS

### Next Step:

Run manual testing checklist for Edit Mode functionality before proceeding to Phase 3.
