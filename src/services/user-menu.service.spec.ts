import { TestBed } from '@angular/core/testing';

import { UserMenuService } from './user-menu.service';

describe('UserMenuService', () => {
  let service: UserMenuService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserMenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
