import { Component, signal, Inject, PLATFORM_ID, OnInit  } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { IntroOverlayComponent } from './core/intro-overlay/intro-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IntroOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit{
  protected readonly title = signal('dabubble');

  constructor(
    private router: Router,
    public dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // intro //
  showIntro = true;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const seen = localStorage.getItem('introSeen') === '1';

    this.showIntro = !seen && this.router.url === '/';
    if (this.showIntro) document.body.classList.add('intro-active');

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const onLogin = e.urlAfterRedirects === '/';
        const seenNow = localStorage.getItem('introSeen') === '1';
        const shouldShow = onLogin && !seenNow;

        if (shouldShow && !this.showIntro) {
          this.showIntro = true;
          document.body.classList.add('intro-active');
        } else if (!shouldShow && this.showIntro) {
          this.showIntro = false;
          document.body.classList.remove('intro-active');
        }
      });
  }

  onIntroDone(): void {
    this.showIntro = false;
    document.body.classList.remove('intro-active');
    try { localStorage.setItem('introSeen', '1'); } catch {}
  }
  // intro //

}
