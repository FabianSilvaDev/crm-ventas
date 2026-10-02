import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Catálogo central de iconos SVG.
 *
 * Todos los iconos son `stroke`-based, `currentColor`, sin relleno, para poder
 * teñirlos con CSS. El SVG tiene `aria-hidden="true"` y `focusable="false"` porque
 * el significado debe venir del control o texto que lo acompaña; un icono solo no
 * comunica nada a quien no lo ve.
 */

export type IconName = keyof typeof ICONS;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const ICONS = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  growth: 'M12 20V10M18 20V4M6 20v-4',
  sales: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm11 2a3 3 0 1 1-3-3',
  products: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  ai: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-8H8v-2h3zm6 0h-3v-2h3zm-3 3v3h-2v-3z',
  analytics: 'M3 3v18h18M6 17l4-5 3 4 5-8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm9-4.5a1.5 1.5 0 0 1 0 3h-2.1a7.5 7.5 0 0 1-1 2.45l1.49 1.49a1.5 1.5 0 0 1-2.12 2.12l-1.49-1.49a7.5 7.5 0 0 1-2.45 1v2.1a1.5 1.5 0 0 1-3 0v-2.1a7.5 7.5 0 0 1-2.45-1l-1.49 1.49a1.5 1.5 0 0 1-2.12-2.12l1.49-1.49a7.5 7.5 0 0 1-1-2.45H3a1.5 1.5 0 0 1 0-3h2.1a7.5 7.5 0 0 1 1-2.45l-1.49-1.49a1.5 1.5 0 0 1 2.12-2.12l1.49 1.49a7.5 7.5 0 0 1 2.45-1V3a1.5 1.5 0 0 1 3 0v2.1a7.5 7.5 0 0 1 2.45 1l1.49-1.49a1.5 1.5 0 0 1 2.12 2.12l-1.49 1.49a7.5 7.5 0 0 1 1 2.45H21z',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  search: 'm21 21-4.35-4.35M11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7z',
  menu: 'M3 12h18M3 6h18M3 18h18',
  close: 'M18 6 6 18M6 6l12 12',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm11 2a3 3 0 1 1-3-3',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  attention: 'M12 9v4M12 17h.01M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z',
  check: 'M20 6 9 17l-5-5',
  warning: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  danger: 'M12 9v4M12 17h.01M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z',
  info: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 9v7m0-11h.01',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  trendUp: 'M23 6l-9.5 9.5-5-5L1 18',
  trendDown: 'M23 18l-9.5-9.5-5 5L1 6',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 1 0 5.64 15.36',
  campaign: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  lead: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm5-10a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  opportunity: 'M3 4h18l-2 7H5zm0 9h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pipeline: 'M3 3h18v18H3V3zm4 4h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z',
  robot: 'M12 2a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 18h6',
  sparkles: 'M12 3v2M12 19v2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M3 12h2M19 12h2M5.64 18.36l1.41-1.41M16.95 7.05l1.41-1.41',
  flask: 'M9 3v7a4 4 0 0 0 2 3.46V21h2v-7.54A4 4 0 0 0 15 10V3M8 3h8',
  target: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4l-11.09 12L7 11',
  clock: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4v6l4 2',
  money: 'M1 5h22v14H1V5zm5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  calendar: 'M3 5h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM16 1v6M8 1v6M3 11h18',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
} as const;

const SIZES: Record<IconSize, string> = {
  xs: 'var(--icon-xs)',
  sm: 'var(--icon-sm)',
  md: 'var(--icon-md)',
  lg: 'var(--icon-lg)',
  xl: 'var(--icon-xl)',
  '2xl': 'var(--icon-2xl)',
};

@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.html',
  styleUrl: './icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('md');
  readonly klass = input<string>('');

  protected path(): string {
    return ICONS[this.name()] ?? '';
  }

  protected inlineSize(): string {
    return SIZES[this.size()];
  }
}
