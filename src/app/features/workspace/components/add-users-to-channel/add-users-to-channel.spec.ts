import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddUsersToChannel } from './add-users-to-channel';

describe('AddUsersToChannel', () => {
  let component: AddUsersToChannel;
  let fixture: ComponentFixture<AddUsersToChannel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddUsersToChannel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddUsersToChannel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
