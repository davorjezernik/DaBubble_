import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-imprint-layout',
  standalone: true,
  imports: [],
  templateUrl: './imprint-layout.component.html',
  styleUrl: './imprint-layout.component.scss',
})
export class ImprintLayoutComponent {
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
