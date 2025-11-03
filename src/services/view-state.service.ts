import { Injectable } from '@angular/core';

type ViewState = 'devspace' | 'chat' | 'thread';

@Injectable({
  providedIn: 'root',
})
export class ViewStateService {
  currentView: ViewState = 'devspace';
}
