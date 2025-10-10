import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-auth-layout-component',
  imports: [RouterModule],
  templateUrl: './auth-layout-component.html',
  styleUrl: './auth-layout-component.scss',
})
export class AuthLayoutComponent {
  constructor(public router: Router) {}

  isLogin = signal(false);

  isAuth = signal(true);

  ngOnInit(): void {
    const isLoginPage = this.router.url.includes('login');
    this.isLogin.set(isLoginPage);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const isLoginPage = event.urlAfterRedirects.includes('login');
        this.isLogin.set(isLoginPage);
        this.isAuth.set(true);
      });
  }
}
