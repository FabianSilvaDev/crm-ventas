import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EmptyStateComponent } from './empty-state';

@Component({
  selector: 'app-test-host',
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state
      icon="sparkles"
      title="Sin campañas"
      text="Lanza tu primera campaña y empieza a aprender qué funciona."
      actionLabel="Crear campaña"
      actionPath="/growth/campaigns"
    />
  `,
})
class TestHost {}

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza título, texto e icono', () => {
    expect(fixture.nativeElement.textContent).toContain('Sin campañas');
    expect(fixture.nativeElement.querySelector('app-icon')).toBeTruthy();
  });
});
