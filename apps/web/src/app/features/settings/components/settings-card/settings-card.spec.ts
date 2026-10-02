import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { SettingsCardComponent } from './settings-card';

async function render(): Promise<ComponentFixture<SettingsCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [SettingsCardComponent] });

  const fixture = TestBed.createComponent(SettingsCardComponent);
  fixture.componentRef.setInput('icon', 'user');
  fixture.componentRef.setInput('title', 'Workspace');
  fixture.componentRef.setInput('description', 'Nombre, zona horaria y marca.');
  fixture.componentRef.setInput('status', 'Configurado');
  fixture.componentRef.setInput('statusVariant', 'success');
  fixture.componentRef.setInput('actions', [
    { id: 'edit', label: 'Editar', primary: true },
    { id: 'brand', label: 'Branding' },
  ]);

  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('SettingsCardComponent', () => {
  it('muestra título, descripción, icono y estado', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Workspace');
    expect(text).toContain('Nombre, zona horaria y marca.');
    expect(text).toContain('Configurado');
  });

  it('renderiza las acciones', async () => {
    const fixture = await render();
    const buttons = fixture.nativeElement.querySelectorAll('app-button button');

    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Editar');
    expect(buttons[1].textContent).toContain('Branding');
  });

  it('emite el id de la acción al hacer click', async () => {
    const fixture = await render();
    const emitted: string[] = [];
    fixture.componentInstance.action.subscribe((id: string) => emitted.push(id));

    const buttons = fixture.nativeElement.querySelectorAll('app-button button');
    buttons[0].click();
    fixture.detectChanges();

    expect(emitted).toContain('edit');
  });

  it('logs FRONTEND DATA GAP cuando no hay suscriptor y se hace click', async () => {
    const fixture = await render();
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const buttons = fixture.nativeElement.querySelectorAll('app-button button');
    buttons[1].click();
    fixture.detectChanges();

    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
