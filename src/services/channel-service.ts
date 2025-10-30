import { Injectable } from '@angular/core';
import { Firestore, collection, doc, collectionData, docData, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Channel {
  id?: string;
  name: string;
  description?: string;
  members?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ChannelService {
  constructor(private firestore: Firestore) {}

  // Get all documents in 'channels' collection
  getChannels(): Observable<Channel[]> {
    const channelsRef = collection(this.firestore, 'channels');
    return collectionData(channelsRef, { idField: 'id' }) as Observable<Channel[]>;
  }

  // Get single document by ID
  getChannel(id: string): Observable<Channel> {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    return docData(channelDocRef, { idField: 'id' }) as Observable<Channel>;
  }

  // Add a new document
  addChannel(channel: Channel) {
    const channelsRef = collection(this.firestore, 'channels');
    return addDoc(channelsRef, channel);
  }

  // Update an existing document
  updateChannel(id: string, data: Partial<Channel>) {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    return updateDoc(channelDocRef, data);
  }

  // Delete a document
  deleteChannel(id: string) {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    return deleteDoc(channelDocRef);
  }
}
