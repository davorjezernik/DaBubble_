import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageThreadSummaryComponent } from './message-thread-summary.component.ts';

describe('MessageThreadSummaryComponentTs', () => {
  let component: MessageThreadSummaryComponent;
  let fixture: ComponentFixture<MessageThreadSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageThreadSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessageThreadSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
