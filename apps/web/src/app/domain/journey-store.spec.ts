import { TestBed } from '@angular/core/testing';

import { JourneyStore } from './journey-store';

describe('JourneyStore', () => {
  let store: JourneyStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(JourneyStore);
  });

  it('inicializa las 7 fases del Acquisition Journey', () => {
    expect(store.stages().length).toBe(7);
    expect(store.stages().map((s) => s.id)).toEqual([
      'opportunity',
      'intelligence',
      'content',
      'campaign',
      'sales',
      'optimization',
      'learning',
    ]);
  });

  it('cuenta las fases que requieren atención', () => {
    expect(store.attentionCount()).toBe(3);
  });

  it('actualiza el contador de una fase sin bajar de cero', () => {
    store.updateCount('opportunity', 1);
    expect(store.stages().find((s) => s.id === 'opportunity')?.count).toBe(4);

    store.updateCount('opportunity', -10);
    expect(store.stages().find((s) => s.id === 'opportunity')?.count).toBe(0);
  });

  it('cambia el estado de una fase', () => {
    store.setStatus('content', 'attention');
    expect(store.stages().find((s) => s.id === 'content')?.status).toBe('attention');
    expect(store.attentionCount()).toBe(4);
  });
});
