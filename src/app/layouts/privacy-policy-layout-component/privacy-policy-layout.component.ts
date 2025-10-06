import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-privacy-policy-layout',
  standalone: true,
  imports: [],
  templateUrl: './privacy-policy-layout.component.html',
  styleUrl: './privacy-policy-layout.component.scss',
})
export class PrivacyPolicyLayoutComponent {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
