import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SearchBusService {
  readonly query$ = new BehaviorSubject<string>('');
  /**
   * Updates the search query.
   * @param q The new query string.
   */
  set(q: string) {
    this.query$.next((q ?? '').trim());
  }
}
