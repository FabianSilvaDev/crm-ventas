/** Analitica agregada: embudo, atribucion, productos y experimentos. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { Analytics } from '../models/insights.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiService);

  /** `range` es la ventana en dias (7 a 30; 14 por defecto en el backend). */
  get(range = 14): Observable<Analytics> {
    return this.api.getData<Analytics>('/analytics', { range });
  }
}
