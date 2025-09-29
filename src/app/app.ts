import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IntroOverlayComponent } from './intro-overlay/intro-overlay.component';
import { BackdropComponent } from './backdrop-component/backdrop-component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, 
    CommonModule,
    IntroOverlayComponent, 
    BackdropComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('dabubble');

  showIntro = true;
}
