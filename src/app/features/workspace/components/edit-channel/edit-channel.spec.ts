import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditChannel } from './edit-channel';

describe('EditChannel', () => {
  let component: EditChannel;
  let fixture: ComponentFixture<EditChannel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditChannel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditChannel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
