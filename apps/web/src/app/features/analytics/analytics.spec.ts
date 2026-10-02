import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  MetricComponent,
} from '../../ui';
import { Analytics } from './analytics';
import { ChannelPerformanceTableComponent } from './components/channel-performance-table/channel-performance-table';
import { CohortGridComponent } from './components/cohort-grid/cohort-grid';
import { MetricTrendCardComponent } from './components/metric-trend-card/metric-trend-card';

describe('Analytics', () => {
  let fixture: ComponentFixture<Analytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        Analytics,
        CardComponent,
        ButtonComponent,
        BadgeComponent,
        IconComponent,
        EmptyStateComponent,
        MetricTrendCardComponent,
        ChannelPerformanceTableComponent,
        CohortGridComponent,
      ],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Analytics);
    fixture.autoDetectChanges(true);
  });

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  it('renders title, badge Demo and FRONTEND DATA GAP note', () => {
    expect(text()).toContain('Analytics');
    expect(text()).toContain('Demo');
    expect(text()).toContain('FRONTEND DATA GAP: datos de demostración');
  });

  it('renders four metric trend cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-metric-trend-card');
    expect(cards.length).toBe(4);
  });

  it('renders funnel stages', () => {
    const funnel = fixture.nativeElement.querySelector('[aria-label="Embudo de conversión"]');
    expect(funnel).toBeTruthy();
    expect(text()).toContain('Visitantes');
    expect(text()).toContain('Clientes');
  });

  it('renders channel performance table', () => {
    expect(
      fixture.nativeElement.querySelector('app-channel-performance-table')
    ).toBeTruthy();
  });

  it('renders cohort grid', () => {
    expect(
      fixture.nativeElement.querySelector('app-cohort-grid')
    ).toBeTruthy();
  });

  it('renders attribution empty state', () => {
    expect(text()).toContain('Atribución en construcción');
  });

  it('logs data gap when export button is clicked', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const button = fixture.nativeElement.querySelector('app-button button');

    button.click();
    fixture.detectChanges();

    expect(logSpy).toHaveBeenCalledWith(
      'FRONTEND DATA GAP: no backend endpoint to export analytics report'
    );

    logSpy.mockRestore();
  });
});
