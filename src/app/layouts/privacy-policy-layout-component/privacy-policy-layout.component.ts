import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-privacy-policy-layout',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './privacy-policy-layout.component.html',
  styleUrl: './privacy-policy-layout.component.scss',
})
export class PrivacyPolicyLayoutComponent {
  constructor(private location: Location) {}
  goBack() {
    this.location.back();
  }
}
