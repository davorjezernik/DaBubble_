import {
  Component,
  signal,
  Inject,
  PLATFORM_ID,
  OnInit,
  HostListener,
  inject,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { filter, Subscription } from 'rxjs';
import { IntroOverlayComponent } from './core/intro-overlay/intro-overlay.component';
import { AuthService } from '../services/auth-service';
import { UserService } from '../services/user.service';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, IntroOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('dabubble');
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private auth = inject(Auth);

  constructor(
    private router: Router,
    public dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  showIntro = true;
  routeSub?: Subscription;

  /** Initialize intro overlay handling and route listeners. */
  ngOnInit(): void {
    this.setupIntro();
  }

  /** Clean up route subscription. */
  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  /**
   * Configure whether the intro overlay should be shown on first visit.
   * Subscribes to router events to update visibility as navigation occurs.
   */
  private setupIntro() {
    if (!isPlatformBrowser(this.platformId)) return;
    const seen = localStorage.getItem('introSeen') === '1';
    this.showIntro = !seen && this.router.url === '/';
    if (this.showIntro) document.body.classList.add('intro-active');

    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateIntroVisibility(e));
  }

  /**
   * Update the intro overlay state based on current route and persisted flag.
   * @param e NavigationEnd event
   */
  private updateIntroVisibility(e: NavigationEnd) {
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
  }

  /**
   * Mark the intro overlay as completed and persist the seen flag.
   */
  onIntroDone(): void {
    this.showIntro = false;
    document.body.classList.remove('intro-active');
    try {
      localStorage.setItem('introSeen', '1');
    } catch {}
  }

  @HostListener('window:beforeunload', ['$event'])
  /**
   * Mark the current user offline when the window is about to unload.
   */
  onBeforeUnload(event: BeforeUnloadEvent) {
    const user = this.auth.currentUser;
    if (user) {
      this.userService.markOnline(false);
    }
  }
}
