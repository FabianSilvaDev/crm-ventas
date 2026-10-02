import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  AgentCardComponent,
  type Agent,
} from './agent-card';

const agent: Agent = {
  id: 'agent-1',
  name: 'GrowthBot',
  description: 'Optimiza campañas y detecta audiencias prometedoras.',
  status: 'active',
  tasksToday: 12,
  successRate: 91,
};

async function render(
  value: Agent = agent,
): Promise<ComponentFixture<AgentCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [AgentCardComponent] });

  const fixture = TestBed.createComponent(AgentCardComponent);
  fixture.componentRef.setInput('agent', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('AgentCardComponent', () => {
  it('muestra nombre, descripción y estado', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('GrowthBot');
    expect(text).toContain('Optimiza campañas y detecta audiencias prometedoras.');
    expect(text).toContain('Activo');
  });

  it('muestra métricas de tareas y éxito', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('12');
    expect(text).toContain('91%');
  });

  it('emite el agente al pulsar Configurar', async () => {
    const fixture = await render();
    const emitted: Agent[] = [];
    fixture.componentInstance.action.subscribe((a) => emitted.push(a));

    const button = fixture.nativeElement.querySelector('app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toBe(agent);
  });
});
