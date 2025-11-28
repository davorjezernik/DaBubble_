import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Workspac } from './workspac';

describe('Workspac', () => {
  let component: Workspac;
  let fixture: ComponentFixture<Workspac>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Workspac]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Workspac);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
