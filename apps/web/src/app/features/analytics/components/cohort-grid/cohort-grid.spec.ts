import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  CohortGridComponent,
  type CohortWeek,
} from './cohort-grid';

const cohorts: readonly CohortWeek[] = [
  { week: 'S1', values: [100, 45, 30, 20] },
  { week: 'S2', values: [100, 50, 35] },
];

const weeks: readonly string[] = ['W0', 'W1', 'W2', 'W3'];

async function render(
  value: readonly CohortWeek[] = cohorts,
): Promise<ComponentFixture<CohortGridComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CohortGridComponent] });

  const fixture = TestBed.createComponent(CohortGridComponent);
  fixture.componentRef.setInput('cohorts', value);
  fixture.componentRef.setInput('weeks', weeks);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('CohortGridComponent', () => {
  it('muestra semanas como columnas y cohortes como filas', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('S1');
    expect(text).toContain('S2');
    expect(text).toContain('W0');
    expect(text).toContain('W3');
  });

  it('renderiza los valores de retención', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('100%');
    expect(text).toContain('45%');
    expect(text).toContain('50%');
  });
});
