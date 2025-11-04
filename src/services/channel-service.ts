import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  collectionData,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { arrayUnion } from '@angular/fire/firestore';

export interface Channel {
  id?: string;
  name: string;
  description?: string;
  members?: Array<string | { uid: string; displayName?: string }>;
}

@Injectable({
  providedIn: 'root',
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

  async addMembersToChannel(
    channelId: string,
    users: Array<{ uid: string; name?: string }>
  ): Promise<void> {
    const ref = doc(this.firestore, `channels/${channelId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data() as Channel;
    const current = data.members ?? [];
    const existingUids = new Set(
      current.map((m) => (typeof m === 'string' ? m : m.uid)).filter(Boolean)
    );
    const newMemberObjs = users
      .filter((u) => !!u.uid && !existingUids.has(u.uid))
      .map((u) => ({
        uid: u.uid,
        displayName: u.name ?? ''
      }));

    if (!newMemberObjs.length) return;
    const updatedMembers = [...current, ...newMemberObjs];
    await updateDoc(ref, {
      members: updatedMembers,
    });
  }
}
