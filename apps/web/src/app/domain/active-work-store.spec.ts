import { TestBed } from '@angular/core/testing';

import { ActiveWorkStore } from './active-work-store';

describe('ActiveWorkStore', () => {
  let store: ActiveWorkStore;

  const recommendation = {
    id: 'rec-test',
    agentId: 'agent-test',
    agentName: 'Agent Test',
    title: 'Test recommendation',
    what: 'What',
    why: ['Why'],
    confidence: 80,
    impact: 'medium' as const,
    impactDescription: 'Medium impact',
    actionLabel: 'Go',
    actionPath: '/test',
    stageId: 'opportunity' as const,
    status: 'approved' as const,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ActiveWorkStore);
  });

  it('inicia sin tareas', () => {
    expect(store.items().length).toBe(0);
    expect(store.todoCount()).toBe(0);
  });

  it('crea un item desde una recomendación', () => {
    const item = store.addFromRecommendation(recommendation);

    expect(item.recommendationId).toBe(recommendation.id);
    expect(store.items().length).toBe(1);
    expect(store.todoCount()).toBe(1);
  });

  it('no duplica items para la misma recomendación', () => {
    store.addFromRecommendation(recommendation);
    store.addFromRecommendation(recommendation);

    expect(store.items().length).toBe(1);
  });

  it('marca un item como completado', () => {
    const item = store.addFromRecommendation(recommendation);
    store.complete(item.id);

    expect(store.items()[0].status).toBe('done');
    expect(store.todoCount()).toBe(0);
    expect(store.doneCount()).toBe(1);
  });

  it('elimina un item', () => {
    const item = store.addFromRecommendation(recommendation);
    store.remove(item.id);

    expect(store.items().length).toBe(0);
  });
});
