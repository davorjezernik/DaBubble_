import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

type ViewState = 'devspace' | 'chat' | 'thread';

@Injectable({
  providedIn: 'root',
})
export class ViewStateService {
  currentView: ViewState = 'devspace';
  isMobileView: boolean = false;

  private closeThreadDrawerSource = new Subject<void>();
  private closeDevspaceDrawerSource = new Subject<void>();

  closeThreadDrawer$ = this.closeThreadDrawerSource.asObservable();
  closeDevspaceDrawer$ = this.closeDevspaceDrawerSource.asObservable();

  requestCloseThreadDrawer() {
    if (window.innerWidth <= 1320) {
      this.closeThreadDrawerSource.next();
    }
  }

  requestCloseDevspaceDrawer() {
    if (window.innerWidth <= 1320) {
      this.closeDevspaceDrawerSource.next();
    }
  }
}
