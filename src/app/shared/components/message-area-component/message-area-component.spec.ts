import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageAreaComponent } from './message-area-component';



describe('MessageAreaComponentComponent', () => {
  let component: MessageAreaComponent;
  let fixture: ComponentFixture<MessageAreaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageAreaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageAreaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
