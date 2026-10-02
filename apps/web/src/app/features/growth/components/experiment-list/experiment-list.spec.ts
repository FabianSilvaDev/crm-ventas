import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  ExperimentListComponent,
  type Experiment,
} from './experiment-list';

const experiments: readonly Experiment[] = [
  {
    id: 'e-1',
    name: 'CTA primario',
    hypothesis: 'Un botón de acción más directo aumenta la tasa de click.',
    status: 'winner',
    variantA: 'Saber más',
    variantB: 'Comprar ahora',
    winner: 'B',
    lift: 0.18,
  },
  {
    id: 'e-2',
    name: 'Imagen hero',
    hypothesis: 'Vídeo corto vs imagen estática en la landing.',
    status: 'running',
    variantA: 'Imagen estática',
    variantB: 'Vídeo 6s',
    winner: null,
    lift: 0,
  },
];

async function render(
  value: readonly Experiment[] = experiments,
): Promise<ComponentFixture<ExperimentListComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ExperimentListComponent] });

  const fixture = TestBed.createComponent(ExperimentListComponent);
  fixture.componentRef.setInput('experiments', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('ExperimentListComponent', () => {
  it('renderiza una tarjeta por experimento', async () => {
    const fixture = await render();
    const items = fixture.nativeElement.querySelectorAll('.experiment-list__item');

    expect(items.length).toBe(2);
  });

  it('muestra hipótesis, variantes y ganador con lift', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('CTA primario');
    expect(text).toContain('Saber más');
    expect(text).toContain('Comprar ahora');
    expect(text).toContain('Ganador');
    expect(text).toContain('18%');
  });

  it('muestra estado En curso para experimentos sin ganador', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('En curso');
  });
});
