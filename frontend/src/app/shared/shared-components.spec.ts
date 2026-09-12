import { SeverityTagComponent } from './severity-tag/severity-tag.component';
import { StatusBadgeComponent } from './status-badge/status-badge.component';

describe('StatusBadgeComponent', () => {
  it('should map profile statuses to value colors', () => {
    const badge = new StatusBadgeComponent();
    badge.status = 'COMPLETED';
    expect(badge.statusClass()).toBe('text-success');

    badge.status = 'RUNNING';
    expect(badge.statusClass()).toBe('text-warning');

    badge.status = 'PENDING';
    expect(badge.statusClass()).toBe('text-warning');

    badge.status = 'ERROR';
    expect(badge.statusClass()).toBe('text-accent');

    badge.status = 'unknown';
    expect(badge.statusClass()).toBe('text-muted');
  });
});

describe('SeverityTagComponent', () => {
  it('should color confidence tags', () => {
    const tag = new SeverityTagComponent();
    tag.kind = 'confidence';

    tag.value = 'high';
    expect(tag.tagClass()).toBe('text-success');

    tag.value = 'medium';
    expect(tag.tagClass()).toBe('text-warning');

    tag.value = 'low';
    expect(tag.tagClass()).toBe('text-accent');

    tag.value = '';
    expect(tag.tagClass()).toBe('text-muted');
  });

  it('should color severity tags', () => {
    const tag = new SeverityTagComponent();
    tag.kind = 'severity';

    tag.value = 'critical';
    expect(tag.tagClass()).toBe('text-accent');

    tag.value = 'medium';
    expect(tag.tagClass()).toBe('text-warning');

    tag.value = 'low';
    expect(tag.tagClass()).toBe('text-success');
  });
});
