/** Actividad reciente y notificaciones. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { ActivityEvent, Notification } from '../models/insights.model';
import { ApiService, type QueryParams } from './api.service';

export interface ActivityQuery extends QueryParams {
  type?: string;
  severity?: string;
  agentId?: string;
  departmentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly api = inject(ApiService);

  list(query: ActivityQuery = {}): Observable<ApiResponse<ActivityEvent[]>> {
    return this.api.get<ActivityEvent[]>('/activity', query);
  }

  /** Tipos de evento disponibles, para el filtro de la vista. */
  types(): Observable<string[]> {
    return this.api.getData<string[]>('/activity/types');
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);

  list(query: { unreadOnly?: boolean; limit?: number } = {}): Observable<ApiResponse<Notification[]>> {
    return this.api.get<Notification[]>('/notifications', {
      unreadOnly: query.unreadOnly ? 'true' : undefined,
      limit: query.limit,
    });
  }

  markRead(notificationId: string): Observable<Notification> {
    return this.api.postData<Notification>(`/notifications/${notificationId}/read`);
  }

  markAllRead(): Observable<Notification[]> {
    return this.api.postData<Notification[]>('/notifications/read-all');
  }
}
