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

  // Observable Caching (TIER 1, Fix 2)
  private channelsCache$?: Observable<Channel[]>;
  private channelCache = new Map<string, Observable<Channel | null>>();

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
   * Holt einen einzelnen Channel mit Caching (TIER 1, Fix 2)
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
   * Löscht den Observable-Cache (TIER 1, Fix 2)
   */
  clearCache(): void {
    this.channelsCache$ = undefined;
    this.channelCache.clear();
  }
}