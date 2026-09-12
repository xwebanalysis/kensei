import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should GET the health endpoint', () => {
    service.health().subscribe((health) => {
      expect(health.tool).toBe('kensei');
      expect(health.database).toBe('ok');
    });

    const request = httpMock.expectOne(`${service.apiBaseUrl}/api/health`);
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'ok', database: 'ok', version: '0.2.0', tool: 'kensei' });
  });

  it('should list, fetch and delete profiles', () => {
    service.listProfiles().subscribe((profiles) => expect(profiles).toEqual([]));
    httpMock.expectOne(`${service.apiBaseUrl}/api/profiles`).flush([]);

    service.getProfile(7).subscribe();
    httpMock.expectOne(`${service.apiBaseUrl}/api/profiles/7`).flush({ id: 7, technologies: [] });

    service.deleteProfile(7).subscribe();
    const one = httpMock.expectOne(`${service.apiBaseUrl}/api/profiles/7`);
    expect(one.request.method).toBe('DELETE');
    one.flush({ status: 'deleted', profile_id: 7 });

    service.deleteAllProfiles().subscribe();
    const all = httpMock.expectOne(`${service.apiBaseUrl}/api/profiles`);
    expect(all.request.method).toBe('DELETE');
    all.flush({ status: 'deleted', count: 7 });
  });

  it('should fetch a profile report', () => {
    service.report(3).subscribe((report) => expect(report.profile_id).toBe(3));
    httpMock.expectOne(`${service.apiBaseUrl}/api/profiles/3/report`).flush({
      domain: 'example.com',
      profile_id: 3,
      created_at: '2026-01-01T00:00:00',
      summary: {
        technologies_found: 1,
        routes_discovered: 0,
        guards_detected: 0,
        js_dependencies_found: 0,
        categories: ['server'],
      },
      technologies_by_category: {},
    });
  });

  it('should build the compare request with the selected ids', () => {
    service.compare([3, 1, 2]).subscribe();
    const request = httpMock.expectOne(
      `${service.apiBaseUrl}/api/profiles/compare?ids=3,1,2`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ profiles: [], changes: [] });
  });

  it('should encode the trends domain', () => {
    service.trends('example.com/a b').subscribe();
    const request = httpMock.expectOne(
      `${service.apiBaseUrl}/api/profiles/trends?domain=example.com%2Fa%20b`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ domain: 'example.com/a b', points: [] });
  });

  it('should fetch the version database', () => {
    service.versionDb().subscribe((db) => expect(db['react'].latest).toBe('19.0.0'));
    httpMock.expectOne(`${service.apiBaseUrl}/api/version-db`).flush({
      react: { latest: '19.0.0', all: ['18.0.0', '19.0.0'] },
    });
  });

  it('should build the server-side export URL', () => {
    expect(service.exportJsonUrl(7)).toBe(
      `${service.apiBaseUrl}/api/profiles/7/export/json`,
    );
  });

  it('should build live websocket URLs with the target encoded', () => {
    const url = service.liveUrl('https://example.com/a b');
    expect(url).toContain('/api/profile/live?');
    expect(url).toContain('target=https%3A%2F%2Fexample.com%2Fa+b');
    expect(url).toContain('timeout=180');
    expect(url).not.toContain('token=');
  });

  it('should append the optional auth token to live websocket URLs', () => {
    localStorage.setItem('kensei_token', 'secret token');
    const url = service.liveUrl('example.com', 60);
    expect(url).toContain('timeout=60');
    expect(url).toContain('token=secret+token');
  });
});
