# Message Bubble Component Documentation

## Overview

The **Message Bubble Component** is a comprehensive Angular standalone component that displays chat messages with rich interaction features including reactions, editing, deletion, and thread navigation. It supports both incoming and outgoing message styles and provides a fully responsive user experience across desktop and mobile devices.

---

## Architecture

### Component Files

| File                                   | Purpose                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| `message-bubble.component.ts`          | Main component logic and state management                     |
| `message-bubble.component.html`        | Template with conditional rendering for different states      |
| `message-bubble.component.scss`        | Responsive styling with desktop/mobile variants               |
| `message-logic.service.ts`             | Business logic for message operations and data transformation |
| `message-reaction.service.ts`          | Reactive state management for emoji reactions                 |
| `confirm-delete-dialog.component.ts`   | Delete confirmation dialog                                    |
| `confirm-delete-dialog.component.scss` | Dialog styling                                                |

---

## Core Component: MessageBubbleComponent

### Inputs

| Input             | Type                                            | Default                  | Description                                  |
| ----------------- | ----------------------------------------------- | ------------------------ | -------------------------------------------- |
| `incoming`        | boolean                                         | false                    | Determines message alignment (left vs right) |
| `name`            | string                                          | 'Frederik Beck'          | Author's display name                        |
| `time`            | string                                          | '15:06 Uhr'              | Message timestamp                            |
| `avatar`          | string                                          | 'assets/img-profile/...' | User avatar image path                       |
| `text`            | string                                          | lorem ipsum...           | Message content                              |
| `chatId`          | string?                                         | -                        | Firestore chat/channel ID                    |
| `messageId`       | string?                                         | -                        | Firestore message document ID                |
| `parentMessageId` | string?                                         | -                        | Parent message ID (for thread context)       |
| `reactionsMap`    | Record<string, number \| Record<string, true>>? | -                        | Reactions data from Firestore                |
| `collectionName`  | 'channels' \| 'dms'                             | 'dms'                    | Firestore collection type                    |
| `lastReplyAt`     | unknown                                         | -                        | Timestamp of last thread reply               |
| `context`         | 'chat' \| 'thread'                              | 'chat'                   | Display context                              |
| `isThreadView`    | boolean                                         | false                    | Whether component is in thread view          |
| `edited`          | boolean?                                        | -                        | Whether message has been edited              |
| `authorId`        | string?                                         | -                        | User ID of message author                    |

### Outputs

| Output        | Type               | Description                           |
| ------------- | ------------------ | ------------------------------------- |
| `editMessage` | EventEmitter<void> | Emitted when edit action is triggered |

### Key Properties

#### State Management

- **showEmojiPicker** (boolean) - Reaction picker visibility
- **reactionsExpanded** (boolean) - Expanded/collapsed reaction list state
- **isMoreMenuOpen** (boolean) - Three-dot menu visibility
- **showMiniActions** (boolean) - Mini action bar visibility
- **isEditing** (boolean) - Edit mode state
- **editText** (string) - Current edit buffer
- **isSaving** (boolean) - Save operation in progress
- **isDeleting** (boolean) - Delete operation in progress
- **editEmojiPickerVisible** (boolean) - Edit mode emoji picker visibility

#### Computed Data

- **reactions** (MessageReaction[]) - Processed reaction list with user data
- **answersCount** (number) - Number of thread replies
- **lastTime** (string) - Last reply timestamp formatted
- **tooltipVisibleForEmoji** (string | null) - Currently hovered reaction emoji

#### Responsive Flags

- **isNarrow** (boolean) - Viewport <= 450px
- **isVeryNarrow** (boolean) - Viewport <= 400px
- **isMobile** (boolean) - Viewport <= 768px

#### Constants

- **DELETED_PLACEHOLDER** = 'Diese Nachricht wurde gelöscht.'
- **MAX_UNIQUE_REACTIONS** = 20
- **DEFAULT_COLLAPSE_THRESHOLD** = 7
- **NARROW_COLLAPSE_THRESHOLD** = 6
- **VERY_NARROW_COLLAPSE_THRESHOLD** = 4

---

## Services

### MessageLogicService

Injectable service (`providedIn: 'root'`) handling core message operations and data transformations.

#### Key Methods

##### `buildMessageDocPath()`

```typescript
buildMessageDocPath(
  collectionName: 'channels' | 'dms',
  chatId: string | undefined,
  messageId: string | undefined,
  isThreadView: boolean,
  parentMessageId?: string
): string | null
```

Constructs Firestore document path for message operations.

- Returns path like `channels/{chatId}/messages/{messageId}`
- Thread messages: `channels/{chatId}/messages/{parentId}/thread/{messageId}`

##### `truncateFullName()`

```typescript
truncateFullName(name: string): string
```

Shortens first and last name to max 12 characters each with ellipsis.

- Single word: truncate to 12 chars
- Multiple words: truncate first and last separately

##### `rebuildReactions()`

```typescript
rebuildReactions(
  reactionsMap: Record<string, number | Record<string, true>> | null | undefined,
  currentUserId: string | null
): MessageReaction[]
```

Transforms Firestore reactions data into display-ready format.

- Handles legacy count format (number)
- Handles user map format (Record<userId, true>)
- Loads user names asynchronously
- Sorts by count (descending)

##### `addReaction()`

```typescript
async addReaction(
  path: string | null,
  emoji: string,
  currentUserId: string,
  legacy = false
): Promise<void>
```

Adds user to reaction or creates new reaction.

##### `removeReaction()`

```typescript
async removeReaction(
  path: string | null,
  emoji: string,
  currentUserId: string,
  legacy = false
): Promise<void>
```

Removes user from reaction using Firestore `deleteField()`.

##### `saveEditedText()`

```typescript
async saveEditedText(
  path: string | null,
  newText: string
): Promise<void>
```

Updates message text and sets `edited: true` flag.

##### `softDeleteMessage()`

```typescript
async softDeleteMessage(
  path: string | null,
  deletedPlaceholder: string
): Promise<void>
```

Replaces message text with placeholder and removes reactions.

#### Internal Features

- **nameCache** (Map<string, string>) - Caches loaded user names
- **subscribedUids** (Set<string>) - Tracks active subscriptions
- **onNamesUpdated** (callback) - Notifies component when names load

---

### MessageReactionService

Injectable service (`providedIn: 'root'`) managing reactive state for reactions and emoji pickers.

#### Reactive State (BehaviorSubjects)

| Observable                | Type              | Purpose                           |
| ------------------------- | ----------------- | --------------------------------- |
| `reactions$`              | MessageReaction[] | Current reactions list            |
| `showEmojiPicker$`        | boolean           | Main reaction picker visibility   |
| `editEmojiPickerVisible$` | boolean           | Edit mode emoji picker visibility |

#### Key Methods

##### `rebuildReactions()`

Delegates to MessageLogicService and updates `reactions$` stream.

##### `toggleEmojiPicker()` / `openEmojiPicker()` / `closeEmojiPicker()`

Controls main reaction picker state.

##### `toggleEditEmojiPicker()` / `closeEditEmojiPicker()`

Controls edit mode emoji picker state.

##### `addOrIncrementReaction()`

```typescript
async addOrIncrementReaction(
  path: string | null,
  emoji: string,
  currentUserId: string
): Promise<void>
```

Adds reaction and auto-closes picker.

##### `handleReactionClick()`

```typescript
async handleReactionClick(
  path: string | null,
  emoji: string,
  currentUserId: string
): Promise<void>
```

Toggles user's reaction on/off based on current state.

---

## Reaction System

### Data Structure

#### MessageReaction Interface

```typescript
interface MessageReaction {
  emoji: string; // Unicode emoji or '✅'
  count: number; // Total users reacted
  userIds: string[]; // Array of user UIDs
  userNames: string[]; // Array of truncated names
  currentUserReacted: boolean; // Whether current user reacted
  isLegacyCount: boolean; // Legacy number format vs user map
}
```

### Firestore Schema

#### Modern Format (User Map)

```typescript
reactions: {
  "👍": {
    "userId1": true,
    "userId2": true
  },
  "❤️": {
    "userId3": true
  }
}
```

#### Legacy Format (Count Only)

```typescript
reactions: {
  "👍": 5,
  "❤️": 2
}
```

### Reaction Display Logic

#### Collapse Thresholds

- **Desktop** (> 450px): Show 7 reactions
- **Narrow** (≤ 450px): Show 6 reactions
- **Very Narrow** (≤ 400px): Show 4 reactions
- **Maximum**: 20 unique reactions total

#### Computed Properties

- **visibleReactions** - Slice of reactions array based on threshold
- **hasMore** - Whether hidden reactions exist
- **moreCount** - Number of hidden reactions
- **shouldCenterNarrow** - Center alignment on narrow viewports with ≥2 reactions

#### Tooltip Display

Shows on hover (desktop) or when `tooltipVisibleForEmoji` is set:

- Emoji icon
- Comma-separated user names
- "hat reagiert" (singular) or "haben reagiert" (plural)

---

## Editing System

### Edit Mode Flow

1. **Enter Edit Mode**: `startEdit()`

   - Sets `isEditing = true`
   - Copies `text` to `editText`
   - Hides mini actions
   - Auto-sizes textarea

2. **Text Input**: `onEditInput(event)`

   - Updates `editText` buffer
   - Calls `autosizeEditTextarea()`

3. **Emoji Insertion**: `onEditEmojiSelected(emoji)`

   - Appends emoji to `editText`
   - Closes emoji picker
   - Auto-sizes textarea

4. **Save**: `saveEdit()`

   - Validates non-empty trimmed text
   - Calls `messageLogic.saveEditedText()`
   - Updates local `text` and `edited` flag
   - Exits edit mode

5. **Cancel**: `cancelEdit()`
   - Discards changes
   - Exits edit mode

### Auto-sizing Textarea

```typescript
autosizeEditTextarea() {
  const el = this.editTextareaRef?.nativeElement;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
```

---

## Deletion System

### Delete Flow

1. **Open Confirmation**: `openConfirmDelete()`

   - Opens Material Dialog with `ConfirmDeleteDialogComponent`
   - Closes more menu

2. **User Confirms**: `confirmDelete()`
   - Sets `isDeleting = true`
   - Calls `messageLogic.softDeleteMessage()`
   - Updates local `text` to placeholder
   - Clears reactions
   - Sets `isDeleting = false`

### Soft Delete Behavior

- Text replaced with "Diese Nachricht wurde gelöscht."
- All reactions removed
- Mini actions hidden
- Edit/delete actions disabled
- Styled with italic gray text

---

## Thread Integration

### Thread Navigation

#### `onCommentClick(event)`

Opens thread panel when clicking comment icon or answers info:

1. Stops event propagation
2. Hides mini actions
3. Requests devspace drawer closure via `viewStateService`
4. Sets `currentView = 'thread'`
5. Calls `threadPanel.openThread()` with:
   - `chatId`
   - `messageId`
   - `collectionName`

### Answers Display

#### Data Loading

- **getAnswersInfo()** - Initializes subscriptions
- **getAnswersAmount()** - Subscribes to thread collection count
- **getLastAnswerTime()** - Subscribes to latest message timestamp

#### Display Format

```html
<div class="answers-info">
  <span class="answers-amount">{{ answersCount }} Antworten</span>
  <span class="last-answer-time">Letzte Antwort {{ lastTime }}</span>
</div>
```

---

## User Interaction

### Mini Actions Bar

Appears on hover (desktop) or tap (mobile) when message is not deleted.

#### Actions Available

1. **✅ Check Mark** (hidden in thread view) - Quick "done" reaction
2. **👍 Thumbs Up** (hidden in thread view) - Quick like
3. **Add Reaction** - Opens emoji picker
4. **Comment** (hidden in thread view) - Opens thread
5. **More Menu** (outgoing only) - Edit/Delete options

#### Positioning

- **Outgoing**: Left 5%, slides in from left
- **Incoming**: Right 5%, slides in from right

#### Behavior

- Desktop: Show on `mouseenter`, hide on `mouseleave`
- Mobile: Toggle on tap, close on outside click

### Emoji Pickers

#### Reaction Picker

- Positioned bottom-left of trigger icon
- Closes on emoji selection
- Closes on document click outside
- Closes on ESC key
- Closes when mouse leaves padded area (12px tolerance)

#### Edit Mode Picker

- Positioned below emoji button in edit actions
- Closes on emoji selection (emoji added to textarea)
- Closes on document click outside
- Closes on ESC key

### Document Click Handlers

#### `onDocumentClick(event)`

Handles:

- Closing more menu
- Hiding reaction tooltips
- Hiding mobile mini actions
- Closing edit emoji picker (if click outside)

#### `onDocumentMouseMove(event)`

Monitors mouse position to auto-close emoji pickers when cursor leaves message area with 12px padding tolerance.

---

## Responsive Design

### Breakpoints

| Width   | Flag           | Behavior                                         |
| ------- | -------------- | ------------------------------------------------ |
| > 768px | Desktop        | Hover interactions, full layout                  |
| ≤ 768px | `isMobile`     | Tap interactions, compact tooltips               |
| ≤ 450px | `isNarrow`     | Reduced reaction threshold, centered reactions   |
| ≤ 400px | `isVeryNarrow` | Further reduced reactions, vertical answers info |

### Mobile Adaptations

#### Buttons (≤ 700px)

- **Cancel Button**: Shows "✕" icon instead of text
- **Save Button**: Shows "✓" icon instead of text
- Height reduced to 40px

#### Layout (≤ 500px)

- Avatar size: 70px → 50px
- Message gap: 20px → 8px
- Reactions centered when ≥2 visible
- Tooltip width: 120px → 88px, normal word-wrap
- Menu dropdown repositions below button

#### Very Narrow (≤ 400px)

- Header gap: 20px → 16px
- Reactions full width with negative margin
- Answers info vertical flex layout
- Button size: 49px → 30px

### Landscape Mode (height ≤ 500px)

- Avatar: 50px with 8px left margin

---

## Styling Architecture

### SCSS Organization

#### Component Styles

- **Base Layout** - Flexbox structure
- **Message Header** - Name, timestamp, edited badge
- **Speech Bubble** - Rounded corners, background, text
- **Mini Actions** - Absolute positioned action bar
- **Reactions** - Chip list with tooltips
- **Edit Mode** - Textarea and action buttons
- **More Menu** - Dropdown positioning

#### Variants

- **`.incoming`** - Left-aligned with different bubble style
- **`.editing`** - White background with border
- **`.deleted`** - Gray italic text

#### Animations

- **miniActionsSlideInLeft** - Slides from left (150ms)
- **miniActionsSlideInRight** - Slides from right (150ms)

#### Hover Effects

- Mini action icons: Circular background on hover
- Reaction chips: Light gray background
- Menu items: Gray background
- User name: Blue color

### Global Overrides

```scss
:host ::ng-deep app-emoji-picker-component {
  // Custom emoji picker styling
  // Hides search, preview, anchors
  // Limits scroll height to 104px
}
```

---

## Accessibility

### ARIA Labels

- More menu button: `aria-label="Weitere Aktionen"`
- Check mark icon: `aria-label="Erledigt"`
- SVG icons: `role="img" focusable="false"`
- Delete dialog: `role="dialog" aria-modal="true" aria-label="..."`

### Keyboard Support

- **ESC Key**: Closes menus and pickers
- **Focus Visible**: Custom outline on button focus

### Semantic HTML

- `<button>` elements for all clickable actions
- `role="menu"` and `role="menuitem"` for dropdown
- Proper heading hierarchy

---

## Dependencies

### Angular Core

- `@angular/core` - Component, Input, Output, HostListener, ViewChild, etc.
- `@angular/common` - CommonModule

### Angular Material

- `@angular/material/dialog` - MatDialog, MatDialogRef

### Firebase

- `@angular/fire/firestore` - Firestore, collection, collectionData, doc, updateDoc, deleteField

### RxJS

- `rxjs` - BehaviorSubject, Observable, Subscription, firstValueFrom, map

### Internal Services

- `ThreadPanelService` - Thread navigation
- `UserService` - User data and authentication
- `ViewStateService` - UI state management

### Internal Components

- `EmojiPickerComponent` - Emoji selection UI
- `DialogUserCardComponent` - User profile dialog

---

## Lifecycle Hooks

### `ngOnInit()`

- Sets up `onNamesUpdated` callback for MessageLogicService
- Subscribes to `currentUser$` to get user ID
- Subscribes to reaction state streams:
  - `reactions$`
  - `showEmojiPicker$`
  - `editEmojiPickerVisible$`

### `ngOnChanges(changes)`

- Rebuilds reactions when `reactionsMap` input changes
- Refreshes answers info

### `ngOnDestroy()`

- Unsubscribes from `answersCountSub`
- Unsubscribes from `reactionStateSub`

---

## Computed Getters

### `displayName`

Returns truncated full name using 12/12 rule.

### `lastReplyDate`

Normalizes `lastReplyAt` to Date object. Handles:

- Date instances
- Firestore Timestamp (with `toDate()`)
- ISO strings
- Epoch numbers

### `isDeleted`

Returns true when text equals `DELETED_PLACEHOLDER`.

### `isEdited`

Returns true when `edited` input is truthy.

---

## Dialog Component

### ConfirmDeleteDialogComponent

Standalone confirmation dialog with Material Design styling.

#### Template

```typescript
template: `
  <div class="delete-dialog">
    <p class="delete-dialog__text">Nachricht wirklich löschen?</p>
    <div class="delete-dialog__actions">
      <button class="btn btn--secondary" (click)="close(false)">Abbrechen</button>
      <button class="btn btn--primary" (click)="close(true)">Löschen</button>
    </div>
  </div>
`;
```

#### Dialog Options

```typescript
{
  panelClass: 'delete-confirm-dialog',
  disableClose: true,
  autoFocus: false
}
```

---

## Best Practices & Patterns

### State Management

- Uses reactive services for shared state (reactions, pickers)
- Local component state for UI-only flags
- Optimistic UI updates on edit/delete

### Error Handling

- Silent catch blocks on Firestore operations
- Validates required data before operations
- Graceful fallbacks for missing data

### Performance

- Subscription cleanup in `ngOnDestroy`
- Debounced name loading (only subscribes once per user)
- Computed properties for derived data
- CSS transitions for smooth animations

### Type Safety

- Strict TypeScript interfaces
- Explicit types for all service methods
- Template type checking with standalone components

### Accessibility First

- Keyboard navigation support
- Screen reader labels
- Focus management in dialogs
- Semantic HTML structure

---

## Future Enhancements

### Potential Features

- Message attachments/media support
- @mentions autocomplete
- Rich text formatting
- Link previews
- Read receipts
- Message search/highlight
- Custom emoji upload
- Reaction animations
- Undo delete (recovery period)
- Message pinning

### Technical Improvements

- Virtualization for large reaction lists
- Lazy loading for thread messages
- Offline queue for actions
- WebSocket real-time sync
- Image optimization
- Internationalization (i18n)

---

## Testing Considerations

### Unit Tests

- Test reaction logic (add/remove/toggle)
- Test name truncation edge cases
- Test Firestore path building
- Mock UserService and Firestore

### Integration Tests

- Test edit/delete workflows
- Test thread navigation
- Test emoji picker integration
- Test responsive breakpoints

### E2E Tests

- Test complete user flows
- Test multi-user reaction scenarios
- Test mobile vs desktop behavior
- Test accessibility compliance

---

## Version History

**Current Version**: Angular 18+ Standalone Component

### Breaking Changes from Earlier Versions

- Migrated to standalone component architecture
- Replaced NgModule imports with direct imports
- Updated to new Firestore modular API
- Switched to signals-based reactivity patterns (partial)

---

## Support & Maintenance

### Code Style

- Follows Angular style guide
- Uses BEM naming for CSS classes
- Consistent 2-space indentation
- Explicit return types on public methods

### Documentation

- Inline comments for complex logic
- JSDoc for public API methods
- Type annotations for all parameters

### Git Workflow

- Feature branch: `feature/message-bubble`
- Repository: `MarkCorzilius/DaBubble`

---

_Last Updated: November 24, 2025_
