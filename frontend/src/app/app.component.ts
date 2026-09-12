import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { I18nService } from './core/i18n.service';
import { ThemeService } from './core/theme.service';
import { TranslatePipe } from './shared/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  protected readonly themeService = inject(ThemeService);
  protected readonly i18n = inject(I18nService);

  protected readonly navItems = [
    { path: '/profiler', key: 'nav.profiler' },
    { path: '/js-analysis', key: 'nav.jsAnalysis' },
    { path: '/spa-routes', key: 'nav.spaRoutes' },
    { path: '/history', key: 'nav.history' },
    { path: '/inventory', key: 'nav.inventory' },
  ];

  ngOnInit(): void {
    this.themeService.initTheme();
  }

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  protected toggleLocale(): void {
    this.i18n.toggle();
  }
}
