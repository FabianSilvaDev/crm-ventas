import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  FollowUpListComponent,
  type FollowUp,
} from './follow-up-list';

const followUps: readonly FollowUp[] = [
  {
    id: 'fu-1',
    leadName: 'Ana Pérez',
    type: 'call',
    subject: 'Llamar para confirmar interés',
    dueAt: '2026-10-03T10:00:00.000Z',
    overdue: true,
  },
  {
    id: 'fu-2',
    leadName: 'Luis Gómez',
    type: 'email',
    subject: 'Enviar propuesta',
    dueAt: '2026-10-04T14:00:00.000Z',
    overdue: false,
  },
];

async function render(
  value: readonly FollowUp[] = followUps,
): Promise<ComponentFixture<FollowUpListComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [FollowUpListComponent] });

  const fixture = TestBed.createComponent(FollowUpListComponent);
  fixture.componentRef.setInput('followUps', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('FollowUpListComponent', () => {
  it('renderiza un item por seguimiento', async () => {
    const fixture = await render();
    const items = fixture.nativeElement.querySelectorAll('.follow-up-list__item');

    expect(items.length).toBe(2);
  });

  it('muestra asunto, tipo, lead y fecha', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Llamar para confirmar interés');
    expect(text).toContain('Llamada');
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('03/10');
  });

  it('marca visualmente los vencidos', async () => {
    const fixture = await render();
    const overdue = fixture.nativeElement.querySelector('.follow-up-list__due--overdue');

    expect(overdue).not.toBeNull();
    expect(overdue.textContent).toContain('03/10');
  });
});
