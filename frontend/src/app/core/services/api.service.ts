/**
 * Cliente HTTP unico hacia la API simulada.
 *
 * Responsabilidades:
 *  - Centralizar la URL base (desde `environment`).
 *  - Normalizar TODOS los errores a `NormalizedApiError`, de modo que ninguna
 *    vista tenga que interpretar un `HttpErrorResponse`.
 *  - Descartar parametros vacios para no enviar `?status=undefined`.
 *
 * Ningun componente debe llamar a `HttpClient` directamente (seccion 14).
 */
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiErrorResponse, ApiResponse, NormalizedApiError } from '../models/api.model';

/** Valores admitidos como parametro de consulta. */
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

const toHttpParams = (params?: QueryParams): HttpParams | undefined => {
  if (!params) return undefined;

  let httpParams = new HttpParams();
  let hasValue = false;

  for (const [key, value] of Object.entries(params)) {
    // Un filtro vacio significa "sin filtro": no se envia a la API.
    if (value === undefined || value === null || value === '') continue;
    httpParams = httpParams.set(key, String(value));
    hasValue = true;
  }

  return hasValue ? httpParams : undefined;
};

const normalizeError = (error: unknown): NormalizedApiError => {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorResponse | null;

    if (error.status === 0) {
      return {
        status: 0,
        code: 'NETWORK_ERROR',
        message:
          'No se puede contactar con la API. Comprueba que el backend esta arrancado en el puerto 3000.',
        offline: true,
      };
    }

    return {
      status: error.status,
      code: body?.error?.code ?? `HTTP_${error.status}`,
      message: body?.error?.message ?? error.message ?? 'La API devolvio un error inesperado.',
      details: body?.error?.details,
      offline: false,
    };
  }

  return {
    status: 0,
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Error desconocido al llamar a la API.',
    offline: true,
  };
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** GET que devuelve la envoltura completa `{ data, meta }`. */
  get<T>(path: string, params?: QueryParams): Observable<ApiResponse<T>> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: toHttpParams(params) })
      .pipe(catchError((error) => throwError(() => normalizeError(error))));
  }

  /** GET que devuelve solo `data`; para detalles y resumenes. */
  getData<T>(path: string, params?: QueryParams): Observable<T> {
    return this.get<T>(path, params).pipe(map((response) => response.data));
  }

  /** POST que devuelve la envoltura completa. */
  post<T>(path: string, body?: unknown, params?: QueryParams): Observable<ApiResponse<T>> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), body ?? {}, { params: toHttpParams(params) })
      .pipe(catchError((error) => throwError(() => normalizeError(error))));
  }

  /** POST que devuelve solo `data`. */
  postData<T>(path: string, body?: unknown, params?: QueryParams): Observable<T> {
    return this.post<T>(path, body, params).pipe(map((response) => response.data));
  }

  private url(path: string): string {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${environment.apiBaseUrl}${suffix}`;
  }
}

/** Comprueba si un valor es un error ya normalizado por `ApiService`. */
export const isApiError = (value: unknown): value is NormalizedApiError =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  'message' in value &&
  'offline' in value;
