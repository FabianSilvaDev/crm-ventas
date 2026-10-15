/** Departamentos de la oficina virtual y su carga de trabajo. */
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Department, OfficeGrid } from '../models/agents.model';
import { ApiService } from './api.service';

/** Departamentos + rejilla del escenario, que llega en `meta.grid`. */
export interface DepartmentList {
  departments: Department[];
  grid: OfficeGrid;
}

@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly api = inject(ApiService);

  list(): Observable<ApiResponse<Department[]>> {
    return this.api.get<Department[]>('/departments');
  }

  /** Lista con la rejilla del escenario ya extraida de los metadatos. */
  listWithGrid(): Observable<DepartmentList> {
    return this.api.get<Department[]>('/departments').pipe(
      map((response) => ({
        departments: response.data,
        grid: (response.meta['grid'] as OfficeGrid | undefined) ?? { columns: 4, rows: 2 },
      })),
    );
  }

  get(departmentId: string): Observable<Department> {
    return this.api.getData<Department>(`/departments/${departmentId}`);
  }
}
