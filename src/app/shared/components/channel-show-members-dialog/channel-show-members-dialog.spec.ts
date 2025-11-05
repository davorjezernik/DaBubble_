import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelShowMembersDialog } from './channel-show-members-dialog';

describe('ChannelShowMembersDialog', () => {
  let component: ChannelShowMembersDialog;
  let fixture: ComponentFixture<ChannelShowMembersDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelShowMembersDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelShowMembersDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
