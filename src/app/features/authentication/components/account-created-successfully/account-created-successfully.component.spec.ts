import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountCreatedSuccessfullyComponent } from './account-created-successfully.component';

describe('AccountCreatedSuccessfullyComponent', () => {
  let component: AccountCreatedSuccessfullyComponent;
  let fixture: ComponentFixture<AccountCreatedSuccessfullyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountCreatedSuccessfullyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AccountCreatedSuccessfullyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
