import { Component, Input } from '@angular/core';

export type TagKind = 'confidence' | 'severity';

/** Bracketed, value-colored tag for confidence or severity levels. */
@Component({
  selector: 'app-severity-tag',
  standalone: true,
  template: `<span class="t-caption tag" [class]="tagClass()">[ {{ value }} ]</span>`,
  styles: [
    `
      .tag {
        letter-spacing: 0.08em;
        white-space: nowrap;
        text-transform: uppercase;
      }
    `,
  ],
})
export class SeverityTagComponent {
  @Input({ required: true }) value = '';
  @Input() kind: TagKind = 'confidence';

  tagClass(): string {
    const value = this.value.toLowerCase();

    if (this.kind === 'severity') {
      switch (value) {
        case 'critical':
        case 'high':
          return 'text-accent';
        case 'medium':
          return 'text-warning';
        case 'low':
          return 'text-success';
        default:
          return 'text-muted';
      }
    }

    switch (value) {
      case 'high':
      case 'certain':
      case 'confirmed':
        return 'text-success';
      case 'medium':
      case 'probable':
        return 'text-warning';
      case 'low':
        return 'text-accent';
      default:
        return 'text-muted';
    }
  }
}
