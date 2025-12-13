import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  collectionData,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, shareReplay, map } from 'rxjs';

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
  private firestore = inject(Firestore);
  private env = inject(EnvironmentInjector);

  // Observable Caching (TIER 1, Fix 2c)
  private channelsCache$?: Observable<Channel[]>;
  private channelCache = new Map<string, Observable<Channel>>();

  // Injection Context Wrapper (TIER 3, Fix 10)
  private withCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.env, fn);
  }

  constructor(private router: Router) {}

  // Get all documents in 'channels' collection with caching
  getChannels(): Observable<Channel[]> {
    if (!this.channelsCache$) {
      const channelsRef = collection(this.firestore, 'channels');
      this.channelsCache$ = this.withCtx(() => collectionData(channelsRef, { idField: 'id' })).pipe(
        map((data) => data as Channel[]),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.channelsCache$;
  }

  // Get single document by ID with caching
  getChannel(id: string): Observable<Channel> {
    if (!this.channelCache.has(id)) {
      const channelDocRef = doc(this.firestore, `channels/${id}`);
      const channel$ = this.withCtx(() => docData(channelDocRef, { idField: 'id' })).pipe(
        map((data) => data as Channel),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.channelCache.set(id, channel$);
    }
    return this.channelCache.get(id)!;
  }

  // Clear cache (call after updates)
  clearCache(): void {
    this.channelsCache$ = undefined;
    this.channelCache.clear();
  }

  // Add a new document
  addChannel(channel: Channel) {
    const channelsRef = collection(this.firestore, 'channels');
    return addDoc(channelsRef, channel);
  }

  // Update an existing document
  updateChannel(id: string, data: Partial<Channel>) {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    // Invalidate cache after update
    this.channelCache.delete(id);
    this.channelsCache$ = undefined;
    return updateDoc(channelDocRef, data);
  }

  // Delete a document
  deleteChannel(id: string) {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    // Invalidate cache after delete
    this.clearCache();
    return deleteDoc(channelDocRef);
  }

  async addMembersToChannel(
    channelId: string,
    users: Array<{ uid: string; name?: string }>
  ): Promise<void> {
    const ref = doc(this.firestore, `channels/${channelId}`);

    // 1. aktuelles Doc holen
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data() as Channel;
    const current = data.members ?? [];

    // 2. vorhandene uids rausziehen (egal ob string oder object)
    const existingUids = new Set(
      current.map((m) => (typeof m === 'string' ? m : m.uid)).filter(Boolean)
    );

    // 3. neue Member-Objekte bauen (nur die, die noch nicht drin sind)
    const newMemberObjs = users
      .filter((u) => !!u.uid && !existingUids.has(u.uid))
      .map((u) => ({
        uid: u.uid,
        displayName: u.name ?? '',
      }));

    if (!newMemberObjs.length) return;

    // 4. bestehende behalten, neue hinten dranhängen
    const updatedMembers = [...current, ...newMemberObjs];

    // 5. zurückschreiben
    await updateDoc(ref, {
      members: updatedMembers,
    });

    // Invalidate cache after member update
    this.channelCache.delete(channelId);
    this.channelsCache$ = undefined;
  }

  async leaveChannel(channelId: string, userId: string) {
    const { channelRef, snap } = await this.getChannelRefAndSnap(channelId);
    if (!snap.exists()) return;
    const data = snap.data() as Channel;
    const members = data.members ?? [];
    await this.updateMembersDoc(channelRef, channelId, members, userId);
  }

  private async getChannelRefAndSnap(id: string) {
    const channelRef = doc(this.firestore, `channels/${id}`);
    const snap = await getDoc(channelRef);
    return { channelRef, snap };
  }

  private async updateMembersDoc(
    channelRef: any, channelId: string,
    members: Array<string | { uid: string }>,
    userId: string
  ) {
    const updatedMembers = members.filter((member) =>
      typeof member === 'string' ? member !== userId : member?.uid !== userId
    );
    if (updatedMembers.length === members.length) return;

    await updateDoc(channelRef, {
      members: updatedMembers,
    });

    this.channelCache.delete(channelId);
    this.channelsCache$ = undefined;
  }

  async redirectToBasicChannel() {
    const channelsRef = collection(this.firestore, 'channels');
    const q = query(channelsRef, where('name', '==', 'everyone'));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    const channelDoc = snap.docs[0];
    this.router.navigate([`/workspace/channel/${channelDoc.id}`]);
  }
}
