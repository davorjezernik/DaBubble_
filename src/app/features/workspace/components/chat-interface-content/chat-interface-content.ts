import { Component, OnInit } from '@angular/core';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { query, orderBy, collectionData } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-chat-interface-component',
  standalone: true,
  imports: [MessageAreaComponent, CommonModule],
  templateUrl: './chat-interface-content.html',
  styleUrl: './chat-interface-component.scss',
})
export class ChatInterfaceComponent implements OnInit {
  messages$: Observable<any[]> = of([]);

  constructor(private firestore: Firestore, private route: ActivatedRoute) {
        console.log("Chat Interface Component CREATED!");
  }

  ngOnInit(): void {
    this.messages$ = this.route.paramMap.pipe(
      switchMap((params) => {
        const chatId = params.get('id');
        if (chatId) {
          const messagesRef = collection(this.firestore, `dms/${chatId}/messages`);

          const q = query(messagesRef, orderBy('timestamp'));

          return collectionData(q, { idField: 'id' });
        } else {
          return of([]);
        }
      })
    );
  }

  async handleNewMessage(messageText: string) {
        console.log('Attempting to send message. Current URL:', this.route.snapshot.url);
    const chatId = this.route.snapshot.paramMap.get('id');

    if (!chatId) {
      console.error('No chat ID found in route parameters.');
      return;
    }

    const messageData = {
      text: messageText,
      timestamp: serverTimestamp(),
      authorId: localStorage.getItem('user')
        ? JSON.parse(localStorage.getItem('user')!).uid
        : 'unknown',
    };

    console.log('chatId', chatId);

    const messagesCollectionRef = collection(this.firestore, `dms/${chatId}/messages`);
    await addDoc(messagesCollectionRef, messageData);
  }
}
