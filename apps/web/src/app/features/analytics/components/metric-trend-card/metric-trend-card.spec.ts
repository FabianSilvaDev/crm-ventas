import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  MetricTrendCardComponent,
  type MetricTrend,
} from './metric-trend-card';

const metric: MetricTrend = {
  label: 'Leads',
  value: '247',
  previousValue: '198',
  trend: 'up',
  change: '+24.7%',
  hint: 'vs. mes anterior',
};

async function render(
  value: MetricTrend = metric,
): Promise<ComponentFixture<MetricTrendCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [MetricTrendCardComponent] });

  const fixture = TestBed.createComponent(MetricTrendCardComponent);
  fixture.componentRef.setInput('metric', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('MetricTrendCardComponent', () => {
  it('muestra label, valor y comparación', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Leads');
    expect(text).toContain('247');
    expect(text).toContain('198');
    expect(text).toContain('+24.7%');
  });
});
