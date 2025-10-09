import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreadSidenavContent } from './thread-sidenav-content';

describe('ThreadSidenavContent', () => {
  let component: ThreadSidenavContent;
  let fixture: ComponentFixture<ThreadSidenavContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadSidenavContent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreadSidenavContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
