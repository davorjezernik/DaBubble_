import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddChat } from './add-chat';

describe('AddChat', () => {
  let component: AddChat;
  let fixture: ComponentFixture<AddChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddChat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
