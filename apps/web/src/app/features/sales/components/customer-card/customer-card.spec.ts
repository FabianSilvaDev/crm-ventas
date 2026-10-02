import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  CustomerCardComponent,
  type Customer,
} from './customer-card';

const customer: Customer = {
  id: 'cust-1',
  name: 'Carlos Ruiz',
  company: 'ElectroSur',
  ltv: 120_000,
  lastContact: 'Hace 3 días',
  health: 'good',
};

async function render(
  value: Customer = customer,
): Promise<ComponentFixture<CustomerCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CustomerCardComponent] });

  const fixture = TestBed.createComponent(CustomerCardComponent);
  fixture.componentRef.setInput('customer', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('CustomerCardComponent', () => {
  it('muestra nombre, empresa y salud', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Carlos Ruiz');
    expect(text).toContain('ElectroSur');
    expect(text).toContain('Saludable');
  });

  it('muestra LTV y último contacto', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('$120,000');
    expect(text).toContain('Hace 3 días');
  });

  it('cambia el color según la salud', async () => {
    const fixture = await render({ ...customer, health: 'at-risk' });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('En riesgo');
  });
});
