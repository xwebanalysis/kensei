import { DatePipe } from '@angular/common';
import { Component, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService, DiscoveredRoute, ProfileDetail, ProfileReport } from '../../core/api.service';
import {
  LiveEvent,
  LiveStats,
  applyLiveEvent,
  createLiveStats,
  liveEventLogLine,
  parseLiveEvent,
} from '../../core/live-event';
import { FindingRow, FindingsListComponent } from '../../shared/findings-list/findings-list.component';
import { MetricCardComponent } from '../../shared/metric-card/metric-card.component';
import { TerminalComponent } from '../../shared/terminal/terminal.component';
import { TranslatePipe } from '../../shared/translate.pipe';

interface PhaseRow {
  id: number;
  label: string;
  done: boolean;
  active: boolean;
}

@Component({
  selector: 'app-profiler',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    FindingsListComponent,
    MetricCardComponent,
    TerminalComponent,
    TranslatePipe,
  ],
  templateUrl: './profiler.component.html',
  styleUrls: ['./profiler.component.scss'],
})
export class ProfilerComponent implements OnDestroy {
  protected readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  targetUrl = '';
  scanning = false;
  error = '';
  errorKey = '';
  profileId: number | null = null;
  report: ProfileReport | null = null;
  detail: ProfileDetail | null = null;
  logLines: string[] = [];

  currentPhase = '';
  currentTarget = '';

  stats: LiveStats = createLiveStats();

  phases: PhaseRow[] = [
    { id: 1, label: 'SSL/TLS', done: false, active: false },
    { id: 2, label: 'SERVER FINGERPRINT', done: false, active: false },
    { id: 3, label: 'JS BUNDLE ANALYSIS', done: false, active: false },
    { id: 4, label: 'SPA ROUTE DISCOVERY', done: false, active: false },
  ];

  private ws: WebSocket | null = null;

  startScan(): void {
    const url = this.targetUrl.trim();
    if (!url || this.scanning) {
      return;
    }

    this.scanning = true;
    this.error = '';
    this.errorKey = '';
    this.profileId = null;
    this.report = null;
    this.detail = null;
    this.currentPhase = '';
    this.currentTarget = url;
    this.logLines = [];
    this.stats = createLiveStats();
    this.phases.forEach((phase) => {
      phase.done = false;
      phase.active = false;
    });
    this.cdr.markForCheck();

    this.ws = new WebSocket(this.api.liveUrl(url, 180));

    this.ws.onmessage = (message) => {
      const event = parseLiveEvent(message.data);
      if (!event) {
        return;
      }
      this.handleEvent(event);
      this.cdr.markForCheck();
    };

    this.ws.onerror = () => {
      this.errorKey = 'profiler.wsError';
      this.error = this.api.apiBaseUrl;
      this.scanning = false;
      this.cdr.markForCheck();
    };

    this.ws.onclose = () => {
      if (!this.stats.completed && !this.error) {
        this.errorKey = 'profiler.closedError';
      }
      this.scanning = false;
      this.cdr.markForCheck();
    };
  }

  private handleEvent(event: LiveEvent): void {
    this.stats = applyLiveEvent(this.stats, event);
    const payload = event.payload ?? {};

    const logLine = liveEventLogLine(event);
    if (logLine) {
      this.pushLog(logLine);
    }

    switch (event.type) {
      case 'analysis_started':
        this.profileId = this.stats.profileId;
        this.currentPhase = 'INITIALIZING';
        break;

      case 'analysis_progress': {
        this.profileId = this.stats.profileId;
        this.currentPhase = this.stats.phaseName || this.currentPhase;
        const phase = this.phases.find((row) => row.id === this.stats.phase);
        if (phase) {
          if (payload.status === 'complete') {
            phase.done = true;
            phase.active = false;
          } else {
            phase.active = true;
            this.phases.forEach((row) => {
              if (row.id < phase.id) {
                row.done = true;
              }
            });
          }
        }
        break;
      }

      case 'analysis_completed':
        this.profileId = this.stats.profileId;
        this.scanning = false;
        this.phases.forEach((row) => {
          row.done = true;
          row.active = false;
        });
        this.ws?.close();
        this.fetchReport();
        this.fetchDetail();
        break;

      case 'analysis_error':
        this.errorKey = '';
        this.error = this.stats.error || 'Analysis failed.';
        this.scanning = false;
        this.phases.forEach((row) => {
          row.active = false;
        });
        this.ws?.close();
        break;
    }
  }

  private pushLog(line: string): void {
    this.logLines = [...this.logLines.slice(-199), line];
  }

  fetchReport(): void {
    if (!this.profileId) {
      return;
    }
    this.api.report(this.profileId).subscribe({
      next: (report) => {
        this.report = report;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorKey = 'profiler.reportError';
        this.cdr.markForCheck();
      },
    });
  }

  fetchDetail(): void {
    if (!this.profileId) {
      return;
    }
    this.api.getProfile(this.profileId).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  get guards(): DiscoveredRoute[] {
    return this.detail?.routes.filter((route) => route.route_type === 'guard') || [];
  }

  get regularRoutes(): DiscoveredRoute[] {
    return this.detail?.routes.filter((route) => route.route_type !== 'guard') || [];
  }

  hasError(): boolean {
    return Boolean(this.error || this.errorKey);
  }

  reportCategories(): string[] {
    return this.report?.summary.categories ?? [];
  }

  categoryItems(category: string): FindingRow[] {
    const technologies = this.report?.technologies_by_category[category] ?? [];
    return technologies.map((tech) => ({
      label: tech.name,
      detail: tech.version ? `v${tech.version}` : '',
      tag: tech.confidence,
      tagKind: 'confidence' as const,
    }));
  }

  outdatedItems(): FindingRow[] {
    return (this.report?.outdated_technologies ?? []).map((tech) => ({
      label: tech.name,
      detail: tech.evidence ?? '',
      tag: tech.version,
      tagKind: 'severity' as const,
    }));
  }

  routeItems(): FindingRow[] {
    return this.regularRoutes.map((route) => ({
      label: route.path,
      detail: [route.route_type, route.framework].filter(Boolean).join(' · '),
    }));
  }

  guardItems(): FindingRow[] {
    return this.guards.map((route) => ({
      label: route.path,
      detail: route.framework || 'unknown',
    }));
  }

  dependencyItems(): FindingRow[] {
    return (this.detail?.js_dependencies ?? []).map((dep) => ({
      label: dep.name,
      detail: [dep.version ? `v${dep.version}` : '', dep.package_manager].filter(Boolean).join(' · '),
    }));
  }

  statusLabelKey(): string {
    if (this.scanning) {
      return 'profiler.statusScanning';
    }
    if (this.stats.completed) {
      return 'profiler.statusComplete';
    }
    if (this.error) {
      return 'profiler.statusError';
    }
    return 'profiler.statusReady';
  }

  statusColor(): string {
    if (this.scanning) {
      return 'var(--warning)';
    }
    if (this.stats.completed) {
      return 'var(--success)';
    }
    if (this.error) {
      return 'var(--error)';
    }
    return 'var(--success)';
  }

  ngOnDestroy(): void {
    this.ws?.close();
  }
}
