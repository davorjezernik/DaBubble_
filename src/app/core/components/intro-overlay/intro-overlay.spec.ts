import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IntroOverlay } from './intro-overlay';

describe('IntroOverlay', () => {
  let component: IntroOverlay;
  let fixture: ComponentFixture<IntroOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntroOverlay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IntroOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
