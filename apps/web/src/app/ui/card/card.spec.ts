import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardComponent } from './card';

@Component({
  selector: 'app-test-host',
  imports: [CardComponent],
  template: '<app-card padding="lg">Contenido</app-card>',
})
class TestHost {}

describe('CardComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza el contenido proyectado', () => {
    expect(fixture.nativeElement.textContent).toContain('Contenido');
  });

  it('aplica la clase de padding', () => {
    const card = fixture.nativeElement.querySelector('.card');
    expect(card.classList.contains('card--padding-lg')).toBe(true);
  });
});
