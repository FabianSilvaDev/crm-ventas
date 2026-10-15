/**
 * Servicio de actividad y notificaciones.
 * El feed incluye los eventos historicos de los mocks y todo lo que genera la
 * simulacion mientras el servidor esta vivo.
 */
import { notFound } from '../errors.js';
import { store } from '../store.js';
import { agentRef, departmentRef, referenceByType } from './enrich.js';

export const serializeEvent = (event) => ({
  id: event.id,
  at: event.at,
  type: event.type,
  severity: event.severity,
  message: event.message,
  actor: agentRef(event.actorAgentId),
  department: event.departmentId ? departmentRef(event.departmentId) : null,
  refs: (event.refs ?? []).map((ref) => referenceByType(ref.type, ref.id, ref.label)),
});

export const listActivity = ({ type, severity, agentId, departmentId, search, limit } = {}) => {
  const items = store.activity.filter(
    (event) =>
      (type ? event.type === type : true) &&
      (severity ? event.severity === severity : true) &&
      (agentId ? event.actorAgentId === agentId : true) &&
      (departmentId ? event.departmentId === departmentId : true) &&
      (search ? event.message.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) : true),
  );

  const limited = limit ? items.slice(0, limit) : items;
  return limited.map(serializeEvent);
};

export const listActivityTypes = () => [...new Set(store.activity.map((event) => event.type))].sort();

export const serializeNotification = (notification) => ({ ...notification });

export const listNotifications = ({ unreadOnly } = {}) => {
  const items = store.notifications.filter((notification) => (unreadOnly ? !notification.read : true));
  return {
    items: items.map(serializeNotification),
    unread: store.notifications.filter((notification) => !notification.read).length,
    total: store.notifications.length,
  };
};

export const markNotificationRead = (notificationId) => {
  const notification = store.notifications.find((item) => item.id === notificationId);
  if (!notification) throw notFound(`No existe la notificacion "${notificationId}".`);
  notification.read = true;
  return serializeNotification(notification);
};

export const markAllNotificationsRead = () => {
  for (const notification of store.notifications) notification.read = true;
  return listNotifications({});
};
