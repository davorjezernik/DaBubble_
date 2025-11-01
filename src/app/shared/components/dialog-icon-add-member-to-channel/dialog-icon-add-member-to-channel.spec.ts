import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogIconAddMemberToChannel } from './dialog-icon-add-member-to-channel';

describe('DialogIconAddMemberToChannel', () => {
  let component: DialogIconAddMemberToChannel;
  let fixture: ComponentFixture<DialogIconAddMemberToChannel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogIconAddMemberToChannel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogIconAddMemberToChannel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
