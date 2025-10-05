import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageAreaComponentComponent } from './message-area-component.component';

describe('MessageAreaComponentComponent', () => {
  let component: MessageAreaComponentComponent;
  let fixture: ComponentFixture<MessageAreaComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageAreaComponentComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MessageAreaComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
