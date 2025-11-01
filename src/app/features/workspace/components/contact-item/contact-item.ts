import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-contact-item',
  imports: [RouterModule],
  templateUrl: './contact-item.html',
  styleUrl: './contact-item.scss'
})
export class ContactItem {
  @Input() user: any;
  @Input() meUid: string | null = null;
  @Output() contactClick = new EventEmitter<any>();

  onContactClick() {
    this.contactClick.emit(this.user);
  }

}
