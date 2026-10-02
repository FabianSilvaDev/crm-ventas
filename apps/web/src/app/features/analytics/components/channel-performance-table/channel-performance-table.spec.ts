import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  ChannelPerformanceTableComponent,
  type ChannelMetric,
} from './channel-performance-table';

const channels: readonly ChannelMetric[] = [
  { channel: 'Meta Ads', spend: 4_530, leads: 213, customers: 18, revenue: 12_400, roas: 2.7 },
  { channel: 'Google Ads', spend: 980, leads: 34, customers: 4, revenue: 2_100, roas: 2.1 },
];

async function render(
  value: readonly ChannelMetric[] = channels,
): Promise<ComponentFixture<ChannelPerformanceTableComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ChannelPerformanceTableComponent] });

  const fixture = TestBed.createComponent(ChannelPerformanceTableComponent);
  fixture.componentRef.setInput('channels', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('ChannelPerformanceTableComponent', () => {
  it('muestra una fila por canal con métricas', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Meta Ads');
    expect(text).toContain('Google Ads');
    expect(text).toContain('4530');
    expect(text).toContain('213');
    expect(text).toContain('18');
    expect(text).toContain('12.400');
    expect(text).toContain('2.7x');
  });
});
