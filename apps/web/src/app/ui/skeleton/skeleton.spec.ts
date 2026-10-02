import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonComponent } from './skeleton';

@Component({
  selector: 'app-test-host',
  imports: [SkeletonComponent],
  template: '<app-skeleton variant="text" width="120px" />',
})
class TestHost {}

describe('SkeletonComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('renderiza un elemento oculto para lectores de pantalla', () => {
    const skeleton = fixture.nativeElement.querySelector('.skeleton');

    expect(skeleton).toBeTruthy();
    expect(skeleton.getAttribute('aria-hidden')).toBe('true');
  });
});
