import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { IntroOverlay } from "../../core/components/intro-overlay/intro-overlay";
@Component({
  selector: 'app-auth-layout-component',
  imports: [RouterModule, IntroOverlay],
  templateUrl: './auth-layout-component.html',
  styleUrl: './auth-layout-component.scss',
})
export class AuthLayoutComponent implements OnInit, OnDestroy{
  constructor(public router: Router) {}

  routerSub?: Subscription;

  isLogin = signal(false);

  isAuth = signal(true);

  public showIntro = true;

  ngOnInit(): void {
    const isLoginPage = this.router.url.includes('login');
    this.isLogin.set(isLoginPage);

    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const isLoginPage = event.urlAfterRedirects.includes('login');
        this.isLogin.set(isLoginPage);
        this.isAuth.set(true);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  hideIntro(): void {
    this.showIntro = false;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.hideIntro();
  }
}
