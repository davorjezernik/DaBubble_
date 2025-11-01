import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelInterfaceContent } from './channel-interface-content';

describe('ChannelInterfaceContent', () => {
  let component: ChannelInterfaceContent;
  let fixture: ComponentFixture<ChannelInterfaceContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelInterfaceContent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelInterfaceContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
