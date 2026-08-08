import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';

interface Profile {
  id: number;
  domain_target: string;
  status: string;
  created_at: string;
}

interface CompareResult {
  profiles: Array<{
    profile_id: number;
    domain: string;
    created_at: string;
    technology_count: number;
    technologies: string[];
  }>;
  changes: Array<{
    from_profile: number;
    to_profile: number;
    added: string[];
    removed: string[];
  }>;
}

interface TrendPoint {
  profile_id: number;
  created_at: string;
  technologies: number;
  routes: number;
  guards: number;
  js_dependencies: number;
}

interface TrendsResult {
  domain: string;
  points: TrendPoint[];
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit, OnDestroy {
  profiles: Profile[] = [];
  loading = true;
  error: string | null = null;
  host = window.location.hostname;

  selectedForCompare: Set<number> = new Set();
  compareResult: CompareResult | null = null;
  comparing = false;
  compareError: string | null = null;
  deletingAll = false;
  confirmDeleteId: number | 'all' | null = null;

  trendsDomain = '';
  trendsResult: TrendsResult | null = null;
  trendsLoading = false;
  trendsError: string | null = null;
  private routerSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfiles();
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => this.loadProfiles());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  loadProfiles(): void {
    this.loading = true;
    this.http.get<Profile[]>(`http://${this.host}:8000/api/profiles`)
      .subscribe({
        next: (data) => { this.profiles = data; this.loading = false; this.cdr.detectChanges(); },
        error: () => { this.error = 'Failed to load profiles.'; this.loading = false; this.cdr.detectChanges(); }
      });
  }

  viewProfile(id: number): void {
    this.router.navigate(['/inventory'], { queryParams: { id } });
  }

  toggleCompare(id: number): void {
    if (this.selectedForCompare.has(id)) {
      this.selectedForCompare.delete(id);
    } else {
      this.selectedForCompare.add(id);
    }
    this.compareResult = null;
  }

  runCompare(): void {
    const ids = [...this.selectedForCompare].sort((a, b) => a - b);
    if (ids.length < 2) return;
    this.comparing = true;
    this.compareError = null;
    this.compareResult = null;
    this.http.get<CompareResult>(`http://${this.host}:8000/api/profiles/compare?ids=${ids.join(',')}`)
      .subscribe({
        next: (data) => { this.compareResult = data; this.comparing = false; this.cdr.detectChanges(); },
        error: () => { this.compareError = 'Compare failed.'; this.comparing = false; this.cdr.detectChanges(); }
      });
  }

  requestDelete(id: number | 'all'): void {
    this.confirmDeleteId = id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  confirmDelete(): void {
    if (this.confirmDeleteId === 'all') {
      this.deletingAll = true;
      this.confirmDeleteId = null;
      this.http.delete(`http://${this.host}:8000/api/profiles`).subscribe({
        next: () => { this.deletingAll = false; this.profiles = []; this.selectedForCompare.clear(); this.compareResult = null; this.cdr.detectChanges(); },
        error: () => { this.deletingAll = false; this.error = 'Failed to delete all profiles.'; this.cdr.detectChanges(); }
      });
    } else if (this.confirmDeleteId !== null) {
      const id = this.confirmDeleteId;
      this.confirmDeleteId = null;
      this.http.delete(`http://${this.host}:8000/api/profiles/${id}`)
        .subscribe({ next: () => { this.selectedForCompare.delete(id); this.loadProfiles(); } });
    }
  }

  exportJson(id: number): void {
    window.open(`http://${this.host}:8000/api/profiles/${id}/export/json`, '_blank');
  }

  statusClass(status: string): string {
    return status.toLowerCase();
  }

  loadTrends(): void {
    const domain = this.trendsDomain.trim();
    if (!domain || this.trendsLoading) {
      return;
    }
    this.trendsLoading = true;
    this.trendsError = null;
    this.trendsResult = null;
    this.http.get<TrendsResult>(`http://${this.host}:8000/api/profiles/trends?domain=${encodeURIComponent(domain)}`)
      .subscribe({
        next: (data) => { this.trendsResult = data; this.trendsLoading = false; this.cdr.detectChanges(); },
        error: (err) => {
          this.trendsError = err.error?.detail ?? 'Trends failed.';
          this.trendsLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  trendChart(): { points: Array<{x: number; y: number; label: string; value: number}>; max: number; width: number; height: number } {
    const width = 720;
    const height = 180;
    const pad = 24;
    if (!this.trendsResult || this.trendsResult.points.length === 0) {
      return { points: [], max: 1, width, height };
    }
    const pts = this.trendsResult.points;
    const max = Math.max(1, ...pts.map(p => p.technologies));
    const n = pts.length;
    const chartPts = pts.map((p, i) => ({
      x: n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1),
      y: height - pad - ((p.technologies / max) * (height - pad * 2)),
      label: p.created_at ? new Date(p.created_at).toLocaleDateString() : `#${p.profile_id}`,
      value: p.technologies,
    }));
    return { points: chartPts, max, width, height };
  }

  trendLinePath(): string {
    const chart = this.trendChart();
    return chart.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }
}
