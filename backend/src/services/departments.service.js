/**
 * Servicio de departamentos: agrupa agentes, mide su carga y expone la posicion de
 * cada sala para el escenario pixel art de la oficina virtual.
 */
import { notFound } from '../errors.js';
import { OFFICE_GRID, departmentById, departments } from '../mocks/index.js';
import { store } from '../store.js';
import { agentRef } from './enrich.js';

const buildStats = (departmentId) => {
  const agents = store.agents.filter((agent) => agent.departmentId === departmentId);
  const byStatus = {};
  for (const agent of agents) byStatus[agent.status] = (byStatus[agent.status] ?? 0) + 1;
  return {
    agentCount: agents.length,
    active: agents.filter((agent) => ['working', 'thinking', 'collaborating'].includes(agent.status)).length,
    byStatus,
    tasksCompleted: agents.reduce((total, agent) => total + agent.stats.tasksCompleted, 0),
    successRate:
      agents.length === 0
        ? 0
        : Number((agents.reduce((total, agent) => total + agent.stats.successRate, 0) / agents.length).toFixed(4)),
  };
};

const serializeDepartment = (department) => {
  const members = store.agents.filter((agent) => agent.departmentId === department.id);
  return {
    id: department.id,
    name: department.name,
    shortName: department.shortName,
    description: department.description,
    accent: department.accent,
    room: department.room,
    tile: department.tile,
    stats: buildStats(department.id),
    lead: agentRef(members.slice().sort((a, b) => b.level - a.level)[0]?.id),
    agentIds: members.map((agent) => agent.id),
    agents: members.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      avatar: agent.avatar,
      progress: agent.currentTask?.progress ?? 0,
      taskTitle: agent.currentTask?.title ?? null,
    })),
  };
};

export const listDepartments = () => ({
  grid: OFFICE_GRID,
  departments: departments.map(serializeDepartment),
});

export const getDepartment = (departmentId) => {
  const department = departmentById.get(departmentId);
  if (!department) throw notFound(`No existe el departamento "${departmentId}".`);
  return serializeDepartment(department);
};
