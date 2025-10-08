import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageAreaComponentComponent } from '../message-area-component/message-area-component.component';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
@NgModule({
  declarations: [],
  imports: [CommonModule, MessageAreaComponentComponent, EmojiPickerComponent],
})
export class SharedComponentsModule {}
