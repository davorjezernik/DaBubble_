import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

type ViewState = 'devspace' | 'chat' | 'thread';

@Injectable({
  providedIn: 'root',
})
export class ViewStateService {
  currentView: ViewState = 'devspace';
  isMobileView: boolean = false;

  currentChatId: string = '';

  pageSizeUsers = 4;
  maxVisible = this.pageSizeUsers;

  private closeThreadDrawerSource = new Subject<void>();
  private closeDevspaceDrawerSource = new Subject<void>();

  closeThreadDrawer$ = this.closeThreadDrawerSource.asObservable();
  closeDevspaceDrawer$ = this.closeDevspaceDrawerSource.asObservable();

  /**
   * Requests to close the thread drawer if the window width is less than or equal to 1320px.
   */
  requestCloseThreadDrawer() {
    if (window.innerWidth <= 1320) {
      this.closeThreadDrawerSource.next();
    }
  }

  /**
   * Requests to close the devspace drawer if the window width is less than or equal to 1320px.
   */
  requestCloseDevspaceDrawer() {
    if (window.innerWidth <= 1320) {
      this.closeDevspaceDrawerSource.next();
    }
  }
}
