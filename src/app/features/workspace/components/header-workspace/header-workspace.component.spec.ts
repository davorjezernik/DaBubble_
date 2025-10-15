import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderWorkspaceComponent } from './header-workspace.component';

describe('HeaderWorkspaceComponent', () => {
  let component: HeaderWorkspaceComponent;
  let fixture: ComponentFixture<HeaderWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderWorkspaceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HeaderWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
