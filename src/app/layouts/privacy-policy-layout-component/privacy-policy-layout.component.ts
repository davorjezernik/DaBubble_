import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacy-policy-layout',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './privacy-policy-layout.component.html',
  styleUrl: './privacy-policy-layout.component.scss',
})
export class PrivacyPolicyLayoutComponent {
  constructor(
    private location: Location,
    private router: Router
  ) {}

  goBack() {
    this.location.back();
  }

  goToAuth() {
    this.router.navigate(['/']);
  }
}
