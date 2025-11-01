import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type ThreadCollection = 'channels' | 'dms';

export interface ThreadOpenRequest {
  chatId: string;
  messageId: string;
  collectionName: ThreadCollection;
}

@Injectable({ providedIn: 'root' })
export class ThreadPanelService {
  private _open$ = new Subject<ThreadOpenRequest>();
  readonly open$: Observable<ThreadOpenRequest> = this._open$.asObservable();

  openThread(req: ThreadOpenRequest) {
    if (!req?.chatId || !req?.messageId) return;
    this._open$.next(req);
  }
}
