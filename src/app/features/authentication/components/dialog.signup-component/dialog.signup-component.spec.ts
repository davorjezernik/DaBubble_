import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogSignupComponent } from './dialog.signup-component';


describe('DialogSigninComponent', () => {
  let component: DialogSignupComponent;
  let fixture: ComponentFixture<DialogSignupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogSignupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogSignupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
