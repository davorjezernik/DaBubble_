import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogUserCardGuestComponent } from './dialog.user-card-guest.component';

describe('DialogUserCardGuestComponent', () => {
  let component: DialogUserCardGuestComponent;
  let fixture: ComponentFixture<DialogUserCardGuestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogUserCardGuestComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DialogUserCardGuestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
