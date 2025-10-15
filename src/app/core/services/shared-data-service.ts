import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SharedDataService {
  private userSource = new BehaviorSubject<any>(null);
  user$ = this.userSource.asObservable();

  setUser(user: any) {
    this.userSource.next(user); // update stored data
  }

  getUser() {
    return this.userSource.value; // get the current value (synchronous)
  }

  clearUser() {
    this.userSource.next(null);
  }
}
