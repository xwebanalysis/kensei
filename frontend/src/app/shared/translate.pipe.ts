import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService, TranslationParams } from '../core/i18n.service';

/**
 * Translation pipe: `{{ 'key' | t }}` or `{{ 'key' | t: { count: 3 } }}`.
 * Not pure so it re-evaluates when the locale signal changes.
 */
@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string, params?: TranslationParams): string {
    return this.i18n.t(value, params);
  }
}
