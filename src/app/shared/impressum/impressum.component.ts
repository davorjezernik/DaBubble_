import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-impressum',
  imports: [],
  templateUrl: './impressum.component.html',
  styleUrl: './impressum.component.scss'
})
export class ImpressumComponent {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back(); 
  }
}
