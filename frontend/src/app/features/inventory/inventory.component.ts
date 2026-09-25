import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, ProfileDetail, ProfileSummary, Technology } from '../../core/api.service';
import {
  detectionConfidenceData,
  technologyCategoryData,
} from '../../shared/charts/chart-data';
import { XwaChartComponent, XwaChartDatum } from '../../shared/charts/xwa-chart.component';
import { ExportActionsComponent } from '../../shared/export-actions/export-actions.component';
import { FindingRow, FindingsListComponent } from '../../shared/findings-list/findings-list.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    DatePipe,
    KeyValuePipe,
    ExportActionsComponent,
    FindingsListComponent,
    TranslatePipe,
    XwaChartComponent,
  ],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  profile: ProfileDetail | null = null;
  profiles: ProfileSummary[] = [];
  loading = false;
  errorKey = '';
  selectedId: number | null = null;
  private loadingFromParams = false;

  ngOnInit(): void {
    this.api.listProfiles().subscribe({
      next: (profiles) => {
        this.profiles = profiles;
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });

    this.route.queryParams.subscribe((params) => {
      if (params['id'] && !this.loadingFromParams) {
        this.selectedId = Number.parseInt(params['id'], 10);
        this.loadProfile(this.selectedId);
        this.cdr.markForCheck();
      }
    });
  }

  loadProfile(id: number): void {
    this.loading = true;
    this.errorKey = '';
    this.selectedId = id;
    this.profile = null;
    this.loadingFromParams = true;
    this.router.navigate([], { queryParams: { id }, replaceUrl: true });

    this.api.getProfile(id).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
        this.loadingFromParams = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorKey = 'inv.detailsError';
        this.loading = false;
        this.loadingFromParams = false;
        this.cdr.markForCheck();
      },
    });
  }

  groupedTechs(): Record<string, Technology[]> {
    if (!this.profile) {
      return {};
    }
    const groups: Record<string, Technology[]> = {};
    for (const tech of this.profile.technologies) {
      (groups[tech.category] ??= []).push(tech);
    }
    return groups;
  }

  techItems(technologies: Technology[]): FindingRow[] {
    return technologies.map((tech) => ({
      label: tech.name,
      detail: [tech.version ? `v${tech.version}` : '', tech.evidence].filter(Boolean).join(' · '),
      tag: tech.confidence,
      tagKind: 'confidence' as const,
    }));
  }

  techCategoryData(): XwaChartDatum[] {
    return technologyCategoryData(this.profile?.technologies ?? []);
  }

  confidenceData(): XwaChartDatum[] {
    return detectionConfidenceData(this.profile?.technologies ?? []);
  }

  routeItems(): FindingRow[] {
    return (this.profile?.routes ?? []).map((route) => ({
      label: route.path,
      detail: [route.route_type, route.framework, route.module].filter(Boolean).join(' · '),
    }));
  }

  dependencyItems(): FindingRow[] {
    return (this.profile?.js_dependencies ?? []).map((dep) => ({
      label: dep.name,
      detail: [dep.version ? `v${dep.version}` : '', dep.package_manager, dep.source]
        .filter(Boolean)
        .join(' · '),
    }));
  }
}
