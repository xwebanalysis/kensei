import { Component, Input } from '@angular/core';

import { SeverityTagComponent, TagKind } from '../severity-tag/severity-tag.component';

export interface FindingRow {
  label: string;
  detail?: string | null;
  tag?: string | null;
  tagKind?: TagKind;
}

/**
 * Data-dense list of discovered items (technologies, routes, dependencies,
 * diffs). Dividers only: no zebra striping, no row backgrounds.
 */
@Component({
  selector: 'app-findings-list',
  standalone: true,
  imports: [SeverityTagComponent],
  template: `
    <div class="findings">
      <div class="findings-head">
        <span class="t-label">{{ title }}</span>
        <span class="t-label">{{ items.length }} ITEM(S)</span>
      </div>
      @if (items.length === 0) {
        <div class="t-label findings-empty">{{ emptyText }}</div>
      } @else {
        @for (item of items; track $index) {
          <div class="finding-row">
            <span class="t-data finding-label">{{ item.label }}</span>
            @if (item.detail) {
              <span class="t-caption text-secondary finding-detail">{{ item.detail }}</span>
            }
            @if (item.tag) {
              <app-severity-tag [value]="item.tag" [kind]="item.tagKind || 'confidence'" />
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .findings {
        border: 1px solid var(--border-visible);
        background-color: var(--surface);
      }

      .findings-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        border-bottom: 1px solid var(--border);
      }

      .findings-empty {
        padding: var(--space-md);
        color: var(--text-disabled);
      }

      .finding-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-md);
        padding: var(--space-sm) var(--space-md);
        border-bottom: 1px solid var(--border);
      }

      .finding-row:last-child {
        border-bottom: none;
      }

      .finding-label {
        overflow-wrap: anywhere;
      }

      .finding-detail {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class FindingsListComponent {
  @Input({ required: true }) title = '';
  @Input() items: FindingRow[] = [];
  @Input() emptyText = '[ NO DATA ]';
}
