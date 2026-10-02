import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingStateComponent } from './loading-state';

@Component({
  selector: 'app-test-host',
  imports: [LoadingStateComponent],
  template: '<app-loading-state text="Consultando leads..." />',
})
class TestHost {}

describe('LoadingStateComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza el texto y el role status', () => {
    expect(fixture.nativeElement.textContent).toContain('Consultando leads...');
    expect(fixture.nativeElement.querySelector('.loading-state').getAttribute('role')).toBe('status');
  });
});
