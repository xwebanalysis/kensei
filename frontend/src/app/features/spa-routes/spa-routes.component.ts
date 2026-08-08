import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface ProfileSummary {
  id: number;
  domain_target: string;
}

interface DiscoveredRoute {
  path: string;
  framework: string | null;
  route_type: string;
  module: string | null;
}

interface ProfileDetail {
  id: number;
  domain_target: string;
  created_at: string;
  routes: DiscoveredRoute[];
}

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
  imports: [CommonModule],
  templateUrl: './spa-routes.component.html',
  styleUrls: ['./spa-routes.component.scss']
})
export class SpaRoutesComponent implements OnInit {
  profiles: ProfileSummary[] = [];
  profile: ProfileDetail | null = null;
  loading = false;
  error: string | null = null;
  host = window.location.hostname;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.http.get<ProfileSummary[]>(`http://${this.host}:8000/api/profiles`)
      .subscribe({ next: (data) => { this.profiles = data; this.cdr.detectChanges(); } });
  }

  loadProfile(id: number): void {
    this.loading = true;
    this.error = null;
    this.profile = null;
    this.http.get<ProfileDetail>(`http://${this.host}:8000/api/profiles/${id}`)
      .subscribe({
        next: (data) => { this.profile = data; this.loading = false; this.cdr.detectChanges(); },
        error: () => { this.error = 'Failed to load.'; this.loading = false; this.cdr.detectChanges(); }
      });
  }

  get guards(): DiscoveredRoute[] {
    return this.profile?.routes.filter(r => r.route_type === 'guard') || [];
  }

  get regularRoutes(): DiscoveredRoute[] {
    return this.profile?.routes.filter(r => r.route_type !== 'guard') || [];
  }

  routeMap(): RouteNode[] {
    const routes = this.regularRoutes;
    if (routes.length === 0) {
      return [];
    }

    const children = new Map<string, Map<string, any>>();

    function segments(path: string): string[] {
      return path.split('/').filter(Boolean);
    }

    for (const route of routes) {
      const segs = segments(route.path);
      let level = children;
      for (let i = 0; i < segs.length; i++) {
        if (!level.has(segs[i])) {
          level.set(segs[i], new Map<string, any>());
        }
        const next = level.get(segs[i])!;
        if (i === segs.length - 1) {
          next.set('__route__', route);
        }
        level = next;
      }
    }

    const nodes: RouteNode[] = [];
    const walk = (level: Map<string, Map<string, any>>, depth: number, prefix: string) => {
      for (const [segment, sub] of level) {
        const fullPath = prefix + '/' + segment;
        const route = (sub.get('__route__') ?? null) as DiscoveredRoute | null;
        const hasChildren = sub.size > 1;
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
