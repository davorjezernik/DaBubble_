import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DmInterfaceContent } from './dm-interface-content';

describe('ChatInterfaceComponent', () => {
  let component: DmInterfaceContent;
  let fixture: ComponentFixture<DmInterfaceContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DmInterfaceContent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DmInterfaceContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
