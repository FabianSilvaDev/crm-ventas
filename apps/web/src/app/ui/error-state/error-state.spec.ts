import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorStateComponent } from './error-state';

@Component({
  selector: 'app-test-host',
  imports: [ErrorStateComponent],
  template: '<app-error-state title="No se pudo cargar" detail="Revisa tu conexión." retryLabel="Reintentar" />',
})
class TestHost {}

describe('ErrorStateComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza título, detalle y botón', () => {
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar');
    expect(fixture.nativeElement.textContent).toContain('Revisa tu conexión.');
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });
});
