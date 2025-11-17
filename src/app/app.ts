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
import { Router, RouterOutlet } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { IntroOverlayComponent } from './core/intro-overlay/intro-overlay.component';
import { AuthService } from '../services/auth-service';
import { UserService } from '../services/user.service';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IntroOverlayComponent],
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

  // intro //
  showIntro = true;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.showIntro) document.body.classList.add('intro-active');
  }

  onIntroDone(): void {
    this.showIntro = false;
    document.body.classList.remove('intro-active');
  }
  // intro //

  // sign out close window //
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    const user = this.auth.currentUser;
    if (user) {
      this.userService.markOnline(false);
      this.auth.signOut();
    }
  }
  // sign out close window //
}
