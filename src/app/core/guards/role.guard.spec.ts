import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { roleGuard } from './role.guard';
import { SessionService } from '../services/session.service';

describe('roleGuard', () => {
  let sessionMock: {
    isAuthenticated: jasmine.Spy;
    user: jasmine.Spy;
  };
  let routerMock: { createUrlTree: jasmine.Spy };

  beforeEach(() => {
    sessionMock = {
      isAuthenticated: jasmine.createSpy('isAuthenticated'),
      user: jasmine.createSpy('user')
    };
    routerMock = {
      createUrlTree: jasmine.createSpy('createUrlTree')
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: sessionMock },
        { provide: Router, useValue: routerMock }
      ]
    });
  });

  it('redirects to login when session is missing', () => {
    sessionMock.isAuthenticated.and.returnValue(false);
    const urlTree = {} as UrlTree;
    routerMock.createUrlTree.and.returnValue(urlTree);

    const result = TestBed.runInInjectionContext(() =>
      roleGuard({ data: { roles: ['ADMIN'] } } as any, {} as any)
    );

    expect(result).toBe(urlTree);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('allows ADMIN when role is permitted', () => {
    sessionMock.isAuthenticated.and.returnValue(true);
    sessionMock.user.and.returnValue({ rol: 'ADMIN' });

    const result = TestBed.runInInjectionContext(() =>
      roleGuard({ data: { roles: ['USER', 'ADMIN', 'GOD'] } } as any, {} as any)
    );

    expect(result).toBeTrue();
  });

  it('redirects to access denied when role is not permitted', () => {
    sessionMock.isAuthenticated.and.returnValue(true);
    sessionMock.user.and.returnValue({ rol: 'ADMIN' });
    const urlTree = {} as UrlTree;
    routerMock.createUrlTree.and.returnValue(urlTree);

    const result = TestBed.runInInjectionContext(() =>
      roleGuard({ data: { roles: ['USER'] } } as any, {} as any)
    );

    expect(result).toBe(urlTree);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/access-denied']);
  });
});
