import { Component, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { IntroOverlayComponent } from './intro-overlay/intro-overlay.component';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IntroOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('dabubble');

  // intro //
  showIntro = true;

  ngOnInit(): void {
    document.body.classList.add('intro-active');   
  }

  onIntroDone(): void {
    this.showIntro = false;                       
    document.body.classList.remove('intro-active'); 
  }
  // intro //

  constructor(public dialog: MatDialog, public router: Router) {}
}
