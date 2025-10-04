import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DevspaceSidenavContent } from './devspace-sidenav-content';

describe('DevspaceSidenavContent', () => {
  let component: DevspaceSidenavContent;
  let fixture: ComponentFixture<DevspaceSidenavContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevspaceSidenavContent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DevspaceSidenavContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
