import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-imprint-layout',
  standalone: true,
  imports: [],
  templateUrl: './imprint-layout.component.html',
  styleUrl: './imprint-layout.component.scss',
})
export class ImprintLayoutComponent {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
