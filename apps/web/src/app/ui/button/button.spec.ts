import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonComponent } from './button';

@Component({
  selector: 'app-test-host',
  imports: [ButtonComponent],
  template: '<app-button variant="primary">Guardar</app-button>',
})
class TestHost {}

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza el texto y el tipo por defecto', () => {
    const button = fixture.nativeElement.querySelector('button');

    expect(button.textContent).toContain('Guardar');
    expect(button.getAttribute('type')).toBe('button');
  });
});
