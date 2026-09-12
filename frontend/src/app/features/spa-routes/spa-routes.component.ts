import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ApiService, DiscoveredRoute, ProfileDetail, ProfileSummary } from '../../core/api.service';
import { FindingRow, FindingsListComponent } from '../../shared/findings-list/findings-list.component';
import { TranslatePipe } from '../../shared/translate.pipe';

interface RouteNode {
  label: string;
  depth: number;
  fullPath: string;
  route: DiscoveredRoute | null;
  isGroup: boolean;
  isGuard: boolean;
}

@Component({
  selector: 'app-spa-routes',
  standalone: true,
  imports: [DatePipe, FindingsListComponent, TranslatePipe],
  templateUrl: './spa-routes.component.html',
  styleUrls: ['./spa-routes.component.scss'],
})
export class SpaRoutesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  profiles: ProfileSummary[] = [];
  profile: ProfileDetail | null = null;
  loading = false;
  errorKey = '';

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

  get guards(): DiscoveredRoute[] {
    return this.profile?.routes.filter((route) => route.route_type === 'guard') || [];
  }

  get regularRoutes(): DiscoveredRoute[] {
    return this.profile?.routes.filter((route) => route.route_type !== 'guard') || [];
  }

  guardItems(): FindingRow[] {
    return this.guards.map((route) => ({
      label: route.path,
      detail: route.framework || 'unknown',
    }));
  }

  routeMap(): RouteNode[] {
    const routes = this.regularRoutes;
    if (routes.length === 0) {
      return [];
    }

    type Level = Map<string, Level | DiscoveredRoute>;

    const children: Level = new Map();

    const segments = (path: string): string[] => path.split('/').filter(Boolean);

    for (const route of routes) {
      const parts = segments(route.path);
      let level = children;
      for (let i = 0; i < parts.length; i++) {
        if (!level.has(parts[i])) {
          level.set(parts[i], new Map());
        }
        const next = level.get(parts[i]) as Level;
        if (i === parts.length - 1) {
          next.set('__route__', route);
        }
        level = next;
      }
    }

    const nodes: RouteNode[] = [];
    const walk = (level: Level, depth: number, prefix: string): void => {
      for (const [segment, value] of level) {
        if (segment === '__route__') {
          continue;
        }
        const fullPath = `${prefix}/${segment}`;
        const sub = value as Level;
        const route = (sub.get('__route__') ?? null) as DiscoveredRoute | null;
        const hasChildren = [...sub.keys()].some((key) => key !== '__route__');
        nodes.push({
          label: segment,
          depth,
          fullPath,
          route,
          isGroup: !route || hasChildren,
          isGuard: route?.route_type === 'guard',
        });
        walk(sub, depth + 1, fullPath);
      }
    };
    walk(children, 0, '');
    return nodes;
  }
}
