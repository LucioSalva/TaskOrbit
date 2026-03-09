import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SessionService } from '../services/session.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let sessionMock: { token: () => string | null; logout: jasmine.Spy };

  beforeEach(() => {
    sessionMock = {
      token: () => 'token',
      logout: jasmine.createSpy('logout')
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: sessionMock },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('logs out on 401 responses', (done) => {
    http.get('/api/proyectos').subscribe({
      next: () => {},
      error: () => {
        expect(sessionMock.logout).toHaveBeenCalled();
        done();
      }
    });

    const req = httpMock.expectOne('/api/proyectos');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('keeps session on 403 responses', (done) => {
    http.get('/api/usuarios').subscribe({
      next: () => {},
      error: () => {
        expect(sessionMock.logout).not.toHaveBeenCalled();
        done();
      }
    });

    const req = httpMock.expectOne('/api/usuarios');
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
  });
});
