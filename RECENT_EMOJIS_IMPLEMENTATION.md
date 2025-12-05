# Implementation Plan: Recent Emojis in Mini Actions

This document outlines the steps to implement a feature that displays a user's two most recently used emojis in the message mini-action bar for quick reactions.

### 1. Update User Data Model

I will begin by extending the user data model in Firestore. A new field, `recentEmojis`, will be added to each user's document. This field will be an array of strings, intended to store the native unicode characters of the emojis.

**Example User Document:**

```json
{
  "uid": "some-user-id",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "avatar": "path/to/avatar.png",
  "online": true,
  "recentEmojis": ["😂", "🚀"]
}
```

### 2. Track Emoji Usage

Next, I will modify the existing logic where reactions are added to messages. Whenever a user successfully adds an emoji reaction to any message, that emoji will be recorded. This ensures that the list of recent emojis is always based on the user's actual activity.

### 3. Update User Service

To manage the `recentEmojis` data, I will implement a new method in the `UserService`. This service is the appropriate place to handle updates to user-specific data.

**New Method:** `updateRecentEmojis(userId: string, emoji: string)`

**Logic:**

1.  When a user reacts with an emoji, this method will be called with the `userId` and the `emoji`.
2.  It will fetch the user's current `recentEmojis` array from Firestore.
3.  The new `emoji` will be added to the beginning of the array.
4.  To avoid duplicates, any previous instance of the same emoji will be removed.
5.  The array will be trimmed to a maximum length of 2, ensuring only the most recent emojis are stored.
6.  The updated array will be written back to the user's document in Firestore.

### 4. Display Recent Emojis in Component

Finally, I will update the `MessageMiniActionsComponent` to display the recent emojis.

**Component Logic (`message-mini-actions.component.ts`):**

1.  The component will need access to the current user's data, including the `recentEmojis` array. This will likely involve getting the current user's profile from the `UserService`.
2.  New properties will be added to the component to hold the recent emojis, for example, `recentEmoji1: string | null` and `recentEmoji2: string | null`.

**Template Logic (`message-mini-actions.component.html`):**

1.  The template will be modified to conditionally display the emojis.
2.  I will use `*ngIf` directives to check if `recentEmojis` are available for the user.
3.  An additional condition will check if the current user has already reacted to the message.
4.  **If** the user has `recentEmojis` and has **not** already reacted, the two recent emojis will be displayed as quick reaction buttons.
5.  **Else** (if there are no recent emojis or the user has already reacted), the default "✅" and "👍" icons will be displayed as a fallback.
