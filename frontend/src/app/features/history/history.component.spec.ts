import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { ApiService, CompareResult, ProfileSummary, TrendsResult } from '../../core/api.service';
import { ExportService } from '../../core/export.service';
import { HistoryComponent } from './history.component';

const summaries: ProfileSummary[] = [
  { id: 1, domain_target: 'a.com', status: 'COMPLETED', created_at: '2026-01-01T00:00:00' },
  { id: 2, domain_target: 'b.com', status: 'COMPLETED', created_at: '2026-01-02T00:00:00' },
];

class ApiStub {
  compareCalls: number[][] = [];
  trendCalls: string[] = [];

  listProfiles(): Observable<ProfileSummary[]> {
    return of(summaries);
  }

  exportJsonUrl(id: number): string {
    return `http://localhost:8010/api/profiles/${id}/export/json`;
  }

  compare(ids: number[]): Observable<CompareResult> {
    this.compareCalls.push(ids);
    return of({
      profiles: [],
      changes: [{ from_profile: ids[0], to_profile: ids[1], added: ['next.js'], removed: ['jquery'] }],
    });
  }

  trends(domain: string): Observable<TrendsResult> {
    this.trendCalls.push(domain);
    return of({
      domain,
      points: [
        { profile_id: 1, created_at: '2026-01-01T00:00:00', technologies: 4, routes: 1, guards: 0, js_dependencies: 2 },
        { profile_id: 2, created_at: '2026-01-02T00:00:00', technologies: 7, routes: 3, guards: 1, js_dependencies: 4 },
      ],
    });
  }
}

describe('HistoryComponent', () => {
  let api: ApiStub;
  let exporter: ExportService;

  beforeEach(async () => {
    api = new ApiStub();
    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }],
    }).compileComponents();
    exporter = TestBed.inject(ExportService);
  });

  it('should load profiles on init', () => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.profiles).toHaveLength(2);
  });

  it('should compare the selected profiles in id order', () => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleCompare(2);
    fixture.componentInstance.toggleCompare(1);
    fixture.componentInstance.runCompare();

    expect(api.compareCalls).toEqual([[1, 2]]);
    expect(fixture.componentInstance.compareResult?.changes[0].added).toEqual(['next.js']);
  });

  it('should not compare with fewer than two profiles', () => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.componentInstance.runCompare();
    expect(api.compareCalls).toHaveLength(0);
  });

  it('should load trends and build the chart path', () => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.componentInstance.trendsDomain = 'example.com';
    fixture.componentInstance.loadTrends();

    expect(api.trendCalls).toEqual(['example.com']);
    expect(fixture.componentInstance.trendsResult?.points).toHaveLength(2);

    const chart = fixture.componentInstance.trendChart();
    expect(chart.points).toHaveLength(2);
    expect(chart.max).toBe(7);
    expect(fixture.componentInstance.trendLinePath()).toMatch(/^M.*L/);
  });

  it('should export the list from the client and open the server export', () => {
    const jsonSpy = vi.spyOn(exporter, 'downloadProfilesJson').mockImplementation(() => {});
    const csvSpy = vi.spyOn(exporter, 'downloadProfilesCsv').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();
    fixture.componentInstance.exportListJson();
    fixture.componentInstance.exportListCsv();
    fixture.componentInstance.exportServerJson(1);

    expect(jsonSpy).toHaveBeenCalledOnce();
    expect(csvSpy).toHaveBeenCalledOnce();
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/profiles/1/export/json'),
      '_blank',
      'noopener',
    );
  });
});
