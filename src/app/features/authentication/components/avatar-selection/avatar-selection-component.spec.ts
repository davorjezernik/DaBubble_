import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarSelectComponent } from './avatar-selection-component';

describe('DialogAvatarSelectComponent', () => {
  let component: AvatarSelectComponent;
  let fixture: ComponentFixture<AvatarSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
