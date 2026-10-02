import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
} from '../../ui';
import { SettingsCardComponent } from './components/settings-card/settings-card';
import { Settings } from './settings';

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        Settings,
        CardComponent,
        BadgeComponent,
        EmptyStateComponent,
        SettingsCardComponent,
      ],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    fixture.autoDetectChanges(true);
  });

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  it('renders title and configuration eyebrow', () => {
    expect(text()).toContain('Settings');
    expect(text()).toContain('Workspace');
    expect(text()).toContain('Usuarios y permisos');
    expect(text()).toContain('Integraciones');
  });

  it('renders all six settings cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-settings-card');
    expect(cards.length).toBe(6);
  });

  it('renders billing empty state', () => {
    expect(text()).toContain('Gestión de plan');
    expect(text()).toContain('FRONTEND DATA GAP');
  });

  it('logs data gap when a settings action is clicked', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const button = fixture.nativeElement.querySelector('app-settings-card app-button button');

    button.click();
    fixture.detectChanges();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('FRONTEND DATA GAP: no backend endpoint for settings action')
    );

    logSpy.mockRestore();
  });

  it('logs data gap when billing action is clicked', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const emptyStateButton = fixture.nativeElement.querySelector('app-empty-state button');

    emptyStateButton.click();
    fixture.detectChanges();

    expect(logSpy).toHaveBeenCalledWith(
      'FRONTEND DATA GAP: no backend endpoint for billing/subscription'
    );

    logSpy.mockRestore();
  });
});
