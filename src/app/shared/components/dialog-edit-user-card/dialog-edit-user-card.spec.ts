import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogEditUserCard } from './dialog-edit-user-card';

describe('DialogEditUserCard', () => {
  let component: DialogEditUserCard;
  let fixture: ComponentFixture<DialogEditUserCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogEditUserCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogEditUserCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
