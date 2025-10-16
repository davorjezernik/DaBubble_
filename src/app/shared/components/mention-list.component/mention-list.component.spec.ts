import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MentionListComponent } from './mention-list.component';

describe('MentionListComponent', () => {
  let component: MentionListComponent;
  let fixture: ComponentFixture<MentionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MentionListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MentionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
