import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageAreaComponent } from '../message-area-component/message-area-component';
import { EmojiPickerComponent } from '../emoji-picker-component/emoji-picker-component';
@NgModule({
  declarations: [],
  imports: [CommonModule, MessageAreaComponent, EmojiPickerComponent],
})
export class SharedComponentsModule {}
