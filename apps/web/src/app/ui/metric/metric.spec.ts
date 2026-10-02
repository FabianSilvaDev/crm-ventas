import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetricComponent } from './metric';

@Component({
  selector: 'app-test-host',
  imports: [MetricComponent],
  template: '<app-metric label="Ventas" value="$12.4M" hint="este mes" trend="up" trendValue="18.4%" />',
})
class TestHost {}

describe('MetricComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza label, value y hint', () => {
    expect(fixture.nativeElement.textContent).toContain('Ventas');
    expect(fixture.nativeElement.textContent).toContain('$12.4M');
    expect(fixture.nativeElement.textContent).toContain('este mes');
  });
});
