import { Location } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-imprint-layout',
  standalone: true,
  imports: [],
  templateUrl: './imprint-layout.component.html',
  styleUrl: './imprint-layout.component.scss',
})
export class ImprintLayoutComponent {
  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
