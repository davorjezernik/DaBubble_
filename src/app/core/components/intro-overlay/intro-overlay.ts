import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-intro-overlay',
  imports: [],
  templateUrl: './intro-overlay.html',
  styleUrl: './intro-overlay.scss',
})
export class IntroOverlay implements OnInit {
  @Output() done = new EventEmitter<void>();

  ngOnInit(): void {
    setTimeout(() => {
      this.done.emit();
    }, 3300);
  }
}
