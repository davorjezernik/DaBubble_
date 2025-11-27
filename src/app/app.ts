import {
  Component,
  signal,
  Inject,
  PLATFORM_ID,
  OnInit,
  HostListener,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { filter } from 'rxjs';
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
export class App implements OnInit {
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

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const seen = localStorage.getItem('introSeen') === '1';

    this.showIntro = !seen && this.router.url === '/';
    if (this.showIntro) document.body.classList.add('intro-active');

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
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
    try {
      localStorage.setItem('introSeen', '1');
    } catch {}
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    const user = this.auth.currentUser;
    if (user) {
      this.userService.markOnline(false);
    }
  }
}
