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
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth-service';
import { UserService } from '../services/user.service';
import { Auth } from '@angular/fire/auth';
@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
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

  }

  /** Clean up route subscription. */
  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
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
