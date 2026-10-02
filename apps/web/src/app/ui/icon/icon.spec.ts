import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconComponent, IconName, IconSize } from './icon';

@Component({
  selector: 'app-test-host',
  imports: [IconComponent],
  template: '<app-icon [name]="name()" [size]="size()" />',
})
class TestHost {
  readonly name = signal<IconName>('home');
  readonly size = signal<IconSize>('md');
}

describe('IconComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza el icono solicitado', () => {
    const path = fixture.nativeElement.querySelector('svg path');

    expect(path).toBeTruthy();
    expect(path.getAttribute('d')).toContain('M');
  });

  it('cambia de icono al actualizar la entrada', () => {
    fixture.componentInstance.name.set('search');
    fixture.detectChanges();

    const path = fixture.nativeElement.querySelector('svg path');
    expect(path.getAttribute('d')).toContain('21');
  });

  it('cambia de tamaño al actualizar la entrada', () => {
    fixture.componentInstance.size.set('lg');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg?.style.width).toContain('var(--icon-lg)');
  });
});
