import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';

import { ApiService, ProfileDetail } from '../../core/api.service';
import { ExportService } from '../../core/export.service';
import { I18nService } from '../../core/i18n.service';

/**
 * Shared export toolbar: client-side JSON/CSV/PDF/BIN plus the server-side
 * JSON attachment endpoint. Used by inventory (and any profile detail view).
 */
@Component({
  selector: 'app-export-actions',
  standalone: true,
  template: `
    <div class="export-actions">
      <span class="t-label group-label">{{ i18n.t('export.client') }}</span>
      <button type="button" class="export-btn" (click)="downloadJson()" title="Client-side JSON">
        JSON
      </button>
      <button type="button" class="export-btn" (click)="downloadCsv()" title="Client-side CSV">
        CSV
      </button>
      <button
        type="button"
        class="export-btn"
        (click)="downloadPdf()"
        [disabled]="pdfBusy"
        title="Client-side PDF report"
      >
        {{ pdfBusy ? i18n.t('export.pdfBusy') : 'PDF' }}
      </button>
      <button type="button" class="export-btn" (click)="downloadBinary()" title="Client-side gzip BIN">
        BIN
      </button>
      <span class="t-label group-label server-label">{{ i18n.t('export.server') }}</span>
      <a class="export-btn" [href]="serverUrl()" rel="noopener" title="Server-side JSON attachment">
        JSON
      </a>
      @if (status) {
        <span class="t-label status-inline">{{ status }}</span>
      }
    </div>
  `,
  styles: [
    `
      .export-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .group-label {
        color: var(--text-disabled);
      }

      .server-label {
        margin-left: var(--space-sm);
      }

      .status-inline {
        color: var(--text-secondary);
      }

      .export-btn {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--border-visible);
        background-color: transparent;
        color: var(--text-secondary);
        padding: var(--space-sm) var(--space-md);
        font-family: var(--font-data);
        font-size: var(--label);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        min-height: 36px;
        cursor: pointer;
        text-decoration: none;

        &:hover:not(:disabled) {
          color: var(--gold);
          border-color: var(--gold);
          opacity: 1;
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    `,
  ],
})
export class ExportActionsComponent {
  @Input({ required: true }) profile!: ProfileDetail;

  protected readonly api = inject(ApiService);
  protected readonly exporter = inject(ExportService);
  protected readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected pdfBusy = false;
  protected status = '';

  downloadJson(): void {
    this.exporter.downloadProfileJson(this.profile);
    this.status = this.i18n.t('export.saved');
  }

  downloadCsv(): void {
    this.exporter.downloadProfileCsv(this.profile);
    this.status = this.i18n.t('export.saved');
  }

  downloadBinary(): void {
    this.exporter.downloadProfileBinary(this.profile);
    this.status = this.i18n.t('export.saved');
  }

  async downloadPdf(): Promise<void> {
    if (this.pdfBusy) {
      return;
    }
    this.pdfBusy = true;
    this.status = '';
    try {
      await this.exporter.downloadProfilePdf(this.profile);
      this.status = this.i18n.t('export.saved');
    } catch {
      this.status = this.i18n.t('export.error');
    } finally {
      this.pdfBusy = false;
      this.cdr.markForCheck();
    }
  }

  serverUrl(): string {
    return this.api.exportJsonUrl(this.profile.id);
  }
}
