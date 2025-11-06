import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SearchBusService {
  readonly query$ = new BehaviorSubject<string>('');
  set(q: string) { this.query$.next((q ?? '').trim()); }
}