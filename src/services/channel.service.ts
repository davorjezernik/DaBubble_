import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

export interface Channel {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private firestore = inject(Firestore);

  channels$(): Observable<Channel[]> {
    const ref = collection(this.firestore, 'channels');
    const q = query(ref, orderBy('name'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) =>
        docs.map(d => ({ id: d.id, name: d.name as string }))
      )
    );
  }
}