/** Indicadores agregados de la operacion. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Dashboard } from '../models/insights.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  /**
   * Devuelve la envoltura completa porque la vista necesita ademas los metadatos:
   * la fecha de referencia de la demo se usa para el tiempo relativo de la actividad.
   */
  getDashboard(): Observable<ApiResponse<Dashboard>> {
    return this.api.get<Dashboard>('/dashboard');
  }
}
