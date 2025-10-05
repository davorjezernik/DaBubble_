import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogLoginComponent } from './dialog.login-component';

describe('DialogLoginComponent', () => {
  let component: DialogLoginComponent;
  let fixture: ComponentFixture<DialogLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogLoginComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
