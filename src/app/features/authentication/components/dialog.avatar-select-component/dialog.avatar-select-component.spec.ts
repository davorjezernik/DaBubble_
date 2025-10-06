import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogAvatarSelectComponent } from './dialog.avatar-select-component';

describe('DialogAvatarSelectComponent', () => {
  let component: DialogAvatarSelectComponent;
  let fixture: ComponentFixture<DialogAvatarSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogAvatarSelectComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogAvatarSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
