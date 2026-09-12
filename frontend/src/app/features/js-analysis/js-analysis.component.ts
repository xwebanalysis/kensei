import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ApiService, ProfileDetail, ProfileSummary, VersionDb } from '../../core/api.service';
import { FindingRow, FindingsListComponent } from '../../shared/findings-list/findings-list.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-js-analysis',
  standalone: true,
  imports: [DatePipe, FindingsListComponent, TranslatePipe],
  templateUrl: './js-analysis.component.html',
  styleUrls: ['./js-analysis.component.scss'],
})
export class JsAnalysisComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  profiles: ProfileSummary[] = [];
  profile: ProfileDetail | null = null;
  loading = false;
  errorKey = '';

  versionDb: VersionDb | null = null;
  versionDbLoading = false;
  showVersionDb = false;

  ngOnInit(): void {
    this.api.listProfiles().subscribe({
      next: (profiles) => {
        this.profiles = profiles;
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  loadProfile(id: number): void {
    this.loading = true;
    this.errorKey = '';
    this.profile = null;
    this.api.getProfile(id).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorKey = 'js.loadError';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleVersionDb(): void {
    this.showVersionDb = !this.showVersionDb;
    if (this.showVersionDb && !this.versionDb) {
      this.versionDbLoading = true;
      this.api.versionDb().subscribe({
        next: (db) => {
          this.versionDb = db;
          this.versionDbLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.versionDbLoading = false;
          this.cdr.markForCheck();
        },
      });
    }
  }

  dependencyItems(): FindingRow[] {
    return (this.profile?.js_dependencies ?? []).map((dep) => ({
      label: dep.name,
      detail: [dep.version ? `v${dep.version}` : '', dep.package_manager, dep.source]
        .filter(Boolean)
        .join(' · '),
    }));
  }

  dbItems(): FindingRow[] {
    if (!this.versionDb) {
      return [];
    }
    return Object.keys(this.versionDb)
      .sort()
      .map((name) => ({ label: name, detail: `LATEST: ${this.versionDb![name].latest}` }));
  }
}
