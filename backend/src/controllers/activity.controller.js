/** Actividad reciente y notificaciones del header. */
import {
  listActivity,
  listActivityTypes,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/activity.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseBoolean, parseEnum, parseIntParam, parsePagination } from '../utils/validate.js';

const SEVERITIES = ['info', 'success', 'warning', 'error'];

export const readActivity = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listActivity({
    type: req.query.type,
    severity: parseEnum(req.query.severity, SEVERITIES, 'severity'),
    agentId: req.query.agentId,
    departmentId: req.query.departmentId,
    search: req.query.search,
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { types: listActivityTypes(), severities: SEVERITIES } },
  });
});

export const readActivityTypes = asyncHandler((_req, res) => {
  ok(res, listActivityTypes());
});

export const readNotifications = asyncHandler((req, res) => {
  const unreadOnly = parseBoolean(req.query.unreadOnly, 'unreadOnly', false);
  const limit = parseIntParam(req.query.limit, 'limit', { min: 1, max: 60, fallback: 20 });
  const payload = listNotifications({ unreadOnly });
  ok(res, payload.items.slice(0, limit), { unread: payload.unread, total: payload.total });
});

export const markRead = asyncHandler((req, res) => {
  ok(res, markNotificationRead(req.params.id));
});

export const markAllRead = asyncHandler((_req, res) => {
  const payload = markAllNotificationsRead();
  ok(res, payload.items, { unread: payload.unread, total: payload.total });
});
