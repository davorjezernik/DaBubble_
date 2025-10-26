import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelItem } from './channel-item';

describe('ChannelItem', () => {
  let component: ChannelItem;
  let fixture: ComponentFixture<ChannelItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelItem]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelItem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
