import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeComponent } from './badge';

@Component({
  selector: 'app-test-host',
  imports: [BadgeComponent],
  template: '<app-badge variant="success" label="Activo" [dot]="true" />',
})
class TestHost {}

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza la etiqueta', () => {
    expect(fixture.nativeElement.textContent).toContain('Activo');
  });

  it('muestra el punto cuando dot es true', () => {
    expect(fixture.nativeElement.querySelector('.badge__dot')).toBeTruthy();
  });
});
