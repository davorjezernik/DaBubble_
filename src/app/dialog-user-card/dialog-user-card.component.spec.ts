import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogUserCardComponent } from './dialog-user-card.component';

describe('DialogUserCardComponent', () => {
  let component: DialogUserCardComponent;
  let fixture: ComponentFixture<DialogUserCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogUserCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DialogUserCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
