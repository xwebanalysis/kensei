import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { ApiService, CompareResult, ProfileSummary, TrendsResult } from '../../core/api.service';
import { ExportService } from '../../core/export.service';
import { profilesPerDayData, profileStatusData } from '../../shared/charts/chart-data';
import { XwaChartComponent, XwaChartDatum } from '../../shared/charts/xwa-chart.component';
import { FindingRow, FindingsListComponent } from '../../shared/findings-list/findings-list.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    FindingsListComponent,
    StatusBadgeComponent,
    TranslatePipe,
    XwaChartComponent,
  ],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
})
export class HistoryComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly exporter = inject(ExportService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  profiles: ProfileSummary[] = [];
  loading = true;
  errorKey = '';

  selectedForCompare = new Set<number>();
  compareResult: CompareResult | null = null;
  comparing = false;
  compareErrorKey = '';
  deletingAll = false;
  confirmDeleteId: number | 'all' | null = null;

  trendsDomain = '';
  trendsResult: TrendsResult | null = null;
  trendsLoading = false;
  trendsErrorKey = '';

  private routerSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadProfiles();
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.loadProfiles());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  loadProfiles(): void {
    this.loading = true;
    this.api.listProfiles().subscribe({
      next: (profiles) => {
        this.profiles = profiles;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorKey = 'history.profilesError';
        this.loading = false;
        this.cdr.markForCheck();
      },
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
    if (ids.length < 2) {
      return;
    }
    this.comparing = true;
    this.compareErrorKey = '';
    this.compareResult = null;
    this.api.compare(ids).subscribe({
      next: (result) => {
        this.compareResult = result;
        this.comparing = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.compareErrorKey = 'history.compareError';
        this.comparing = false;
        this.cdr.markForCheck();
      },
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
      this.api.deleteAllProfiles().subscribe({
        next: () => {
          this.deletingAll = false;
          this.profiles = [];
          this.selectedForCompare.clear();
          this.compareResult = null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.deletingAll = false;
          this.errorKey = 'history.deleteAllError';
          this.cdr.markForCheck();
        },
      });
    } else if (this.confirmDeleteId !== null) {
      const id = this.confirmDeleteId;
      this.confirmDeleteId = null;
      this.api.deleteProfile(id).subscribe({
        next: () => {
          this.selectedForCompare.delete(id);
          this.loadProfiles();
          this.cdr.markForCheck();
        },
        error: () => this.cdr.markForCheck(),
      });
    }
  }

  /** Server-side export (JSON attachment endpoint). */
  exportServerJson(id: number): void {
    window.open(this.api.exportJsonUrl(id), '_blank', 'noopener');
  }

  /** Client-side export of the whole list. */
  exportListJson(): void {
    this.exporter.downloadProfilesJson(this.profiles);
  }

  exportListCsv(): void {
    this.exporter.downloadProfilesCsv(this.profiles);
  }

  addedItems(change: CompareResult['changes'][number]): FindingRow[] {
    return change.added.map((name) => ({ label: name }));
  }

  removedItems(change: CompareResult['changes'][number]): FindingRow[] {
    return change.removed.map((name) => ({ label: name }));
  }

  loadTrends(): void {
    const domain = this.trendsDomain.trim();
    if (!domain || this.trendsLoading) {
      return;
    }
    this.trendsLoading = true;
    this.trendsErrorKey = '';
    this.trendsResult = null;
    this.api.trends(domain).subscribe({
      next: (result) => {
        this.trendsResult = result;
        this.trendsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.trendsErrorKey = 'history.trendsError';
        this.trendsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  trendChartData(): XwaChartDatum[] {
    if (!this.trendsResult || this.trendsResult.points.length === 0) {
      return [];
    }
    return this.trendsResult.points.map((point) => ({
      label: point.created_at
        ? new Date(point.created_at).toLocaleDateString()
        : `#${point.profile_id}`,
      value: point.technologies,
    }));
  }

  scansPerDayData(): XwaChartDatum[] {
    return profilesPerDayData(this.profiles);
  }

  statusChartData(): XwaChartDatum[] {
    return profileStatusData(this.profiles);
  }
}
