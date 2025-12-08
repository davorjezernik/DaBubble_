import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, query, orderBy } from '@angular/fire/firestore';
import { Observable, map, shareReplay } from 'rxjs';

export interface Channel {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private firestore = inject(Firestore);
  private channelsCache$?: Observable<Channel[]>;
  private channelCache = new Map<string, Observable<Channel | null>>();

  /**
   * Fetch all channels ordered by name with caching.
   * Uses `shareReplay(1)` to cache the latest list; subsequent calls reuse it.
   * @returns Observable that emits the array of channels `{ id, name }`.
   */
  channels$(): Observable<Channel[]> {
    if (!this.channelsCache$) {
      const ref = collection(this.firestore, 'channels');
      const q = query(ref, orderBy('name'));
      this.channelsCache$ = collectionData(q, { idField: 'id' }).pipe(
        map((docs: any[]) =>
          docs.map(d => ({ id: d.id, name: d.name as string }))
        ),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.channelsCache$;
  }

  /**
   * Holt einen einzelnen Channel mit Caching.
   * @param id Die Channel-ID, die geladen werden soll.
   * @returns Observable, das den Channel `{ id, name }` oder `null` liefert.
   */
  getChannel(id: string): Observable<Channel | null> {
    if (!this.channelCache.has(id)) {
      const ref = doc(this.firestore, 'channels', id);
      const channel$ = docData(ref, { idField: 'id' }).pipe(
        map((d: any | undefined) =>
          d ? { id: d.id, name: d.name as string } : null
        ),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.channelCache.set(id, channel$);
    }
    return this.channelCache.get(id)!;
  }

  /**
   * Löscht den Observable-Cache.
   * Setzt `channelsCache$` zurück und leert den per-ID Cache.
   */
  clearCache(): void {
    this.channelsCache$ = undefined;
    this.channelCache.clear();
  }
}