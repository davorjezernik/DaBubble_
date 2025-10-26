import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaseChatInterfaceComponent } from './base-chat-interface-component';

describe('BaseChatInterfaceComponent', () => {
  let component: BaseChatInterfaceComponent;
  let fixture: ComponentFixture<BaseChatInterfaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BaseChatInterfaceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BaseChatInterfaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
