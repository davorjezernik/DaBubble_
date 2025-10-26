import { Component } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-base-chat-interface-component',
  imports: [],
  template: ``,
})
export class BaseChatInterfaceComponent {
  lastMessageTimestamp: any | null = null;

  shouldShowDateSeparator(messageTimestamp: Timestamp) {
    if (!messageTimestamp) return false;

    let showSeparator = false;
    const currentDate = messageTimestamp.toDate();

    if (!this.lastMessageTimestamp) {
      showSeparator = true;
    } else {
      const lastDate = this.lastMessageTimestamp.toDate();

      if (currentDate.toDateString() !== lastDate.toDateString()) {
        showSeparator = true;
      }
    }
    this.lastMessageTimestamp = messageTimestamp;
    return showSeparator;
  }

  isTodaysMessage(messageTimestamp: Timestamp) {
    const todayTimestamp = Timestamp.now();
    const todayDate = todayTimestamp.toDate();

    if (todayDate.toDateString() === messageTimestamp.toDate().toDateString()) {
      return true;
    } else {
      return false;
    }
  }

  resetLastMessageTimestamp() {
    this.lastMessageTimestamp = null;
  }
}
