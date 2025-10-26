import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactChip } from './contact-chip';

describe('ContactChip', () => {
  let component: ContactChip;
  let fixture: ComponentFixture<ContactChip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactChip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactChip);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
