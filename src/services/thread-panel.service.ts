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

  /**
   * Opens a thread based on the provided request.
   * @param req The thread open request containing chat ID, message ID, and collection name.
   */
  openThread(req: ThreadOpenRequest) {
    if (!req?.chatId || !req?.messageId) return;
    this._open$.next(req);
  }
}
