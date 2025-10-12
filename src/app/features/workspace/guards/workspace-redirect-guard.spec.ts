import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { workspaceRedirectGuard } from './workspace-redirect-guard';

describe('workspaceRedirectGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => workspaceRedirectGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
