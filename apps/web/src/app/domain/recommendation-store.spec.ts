import { TestBed } from '@angular/core/testing';

import { RecommendationStore } from './recommendation-store';

describe('RecommendationStore', () => {
  let store: RecommendationStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(RecommendationStore);
  });

  it('inicializa 4 recomendaciones pendientes', () => {
    expect(store.recommendations().length).toBe(4);
    expect(store.pendingRecommendations().length).toBe(4);
    expect(store.approvedRecommendations().length).toBe(0);
  });

  it('aprueba una recomendación y genera un work item', () => {
    const pending = store.pendingRecommendations()[0];
    const action = store.approve(pending.id);

    expect(action).not.toBeNull();
    expect(action?.type).toBe('approve');
    expect(action?.workItem).not.toBeNull();
    expect(action?.recommendation.status).toBe('approved');

    expect(store.pendingRecommendations().length).toBe(3);
    expect(store.approvedRecommendations().length).toBe(1);
  });

  it('descarta una recomendación sin generar work item', () => {
    const pending = store.pendingRecommendations()[0];
    const action = store.dismiss(pending.id);

    expect(action?.type).toBe('dismiss');
    expect(action?.workItem).toBeNull();
    expect(store.pendingRecommendations().length).toBe(3);
    expect(store.dismissedCount()).toBe(1);
  });

  it('no aprueba dos veces la misma recomendación', () => {
    const pending = store.pendingRecommendations()[0];
    store.approve(pending.id);
    const second = store.approve(pending.id);

    expect(second).toBeNull();
    expect(store.approvedRecommendations().length).toBe(1);
  });
});
