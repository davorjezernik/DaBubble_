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

  private channelsCache$?: Observable<Channel[]>;
  private channelCache = new Map<string, Observable<Channel>>();

  constructor(private router: Router) {}

  /**
   * Wraps a function call in an Angular injection context.
   * @template T
   * @param {() => T} fn The function to execute within the injection context.
   * @returns {T} The result of the function call.
   */
  private withCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.env, fn);
  }

  /**
   * Retrieves all channels from the Firestore 'channels' collection with caching.
   * @returns {Observable<Channel[]>} An observable that emits an array of channels.
   */
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

  /**
   * Retrieves a single channel by its ID from Firestore with caching.
   * @param {string} id The ID of the channel to retrieve.
   * @returns {Observable<Channel>} An observable that emits the channel data.
   */
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

  /**
   * Clears the entire channel cache.
   */
  clearCache(): void {
    this.channelsCache$ = undefined;
    this.channelCache.clear();
  }

  /**
   * Adds a new channel to the Firestore 'channels' collection.
   * @param {Channel} channel The channel object to add.
   * @returns {Promise<any>} A promise that resolves with the document reference of the newly created channel.
   */
  addChannel(channel: Channel) {
    const channelsRef = collection(this.firestore, 'channels');
    return addDoc(channelsRef, channel);
  }

  /**
   * Updates an existing channel in Firestore.
   * @param {string} id The ID of the channel to update.
   * @param {Partial<Channel>} data The partial channel data to update.
   * @returns {Promise<void>} A promise that resolves when the update is complete.
   */
  updateChannel(id: string, data: Partial<Channel>) {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    this.channelCache.delete(id);
    this.channelsCache$ = undefined;
    return updateDoc(channelDocRef, data);
  }

  /**
   * Deletes a channel from Firestore.
   * @param {string} id The ID of the channel to delete.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete.
   */
  deleteChannel(id: string) {
    const channelDocRef = doc(this.firestore, `channels/${id}`);
    this.clearCache();
    return deleteDoc(channelDocRef);
  }

  /**
   * Adds an array of users to a channel's member list, avoiding duplicates.
   * @param {string} channelId The ID of the channel to add members to.
   * @param {Array<{ uid: string; name?: string }>} users An array of user objects to add.
   * @returns {Promise<void>} A promise that resolves when the members have been added.
   */
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
        displayName: u.name ?? '',
      }));

    if (!newMemberObjs.length) return;

    const updatedMembers = [...current, ...newMemberObjs];

    await updateDoc(ref, {
      members: updatedMembers,
    });

    this.channelCache.delete(channelId);
    this.channelsCache$ = undefined;
  }

  /**
   * Removes a user from a channel's member list.
   * @param {string} channelId The ID of the channel to leave.
   * @param {string} userId The ID of the user leaving the channel.
   * @returns {Promise<void>} A promise that resolves when the user has been removed.
   */
  async leaveChannel(channelId: string, userId: string) {
    const { channelRef, snap } = await this.getChannelRefAndSnap(channelId);
    if (!snap.exists()) return;
    const data = snap.data() as Channel;
    const members = data.members ?? [];
    await this.updateMembersDoc(channelRef, channelId, members, userId);
  }

  /**
   * Retrieves a Firestore document reference and snapshot for a given channel ID.
   * @private
   * @param {string} id The ID of the channel.
   * @returns {Promise<{ channelRef: any; snap: any }>} A promise that resolves with the channel reference and snapshot.
   */
  private async getChannelRefAndSnap(id: string) {
    const channelRef = doc(this.firestore, `channels/${id}`);
    const snap = await getDoc(channelRef);
    return { channelRef, snap };
  }

  /**
   * Updates the members array of a channel document in Firestore.
   * @private
   * @param {any} channelRef The Firestore document reference for the channel.
   * @param {string} channelId The ID of the channel.
   * @param {Array<string | { uid: string }>} members The current list of members.
   * @param {string} userId The ID of the user to remove.
   * @returns {Promise<void>} A promise that resolves when the members list is updated.
   */
  private async updateMembersDoc(
    channelRef: any,
    channelId: string,
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

  /**
   * Redirects the user to the 'everyone' channel.
   * @returns {Promise<void>} A promise that resolves when the redirection is complete, or returns undefined if the channel is not found.
   */
  async redirectToBasicChannel() {
    const channelsRef = collection(this.firestore, 'channels');
    const q = query(channelsRef, where('name', '==', 'everyone'));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    const channelDoc = snap.docs[0];
    this.router.navigate([`/workspace/channel/${channelDoc.id}`]);
  }
}
