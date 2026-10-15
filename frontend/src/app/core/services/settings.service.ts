/** Configuracion del workspace, del perfil y de la simulacion. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { Settings } from '../models/insights.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<Settings> {
    return this.api.getData<Settings>('/settings');
  }
}
