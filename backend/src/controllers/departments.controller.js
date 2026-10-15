/** Departamentos de la oficina virtual. */
import { getDepartment, listDepartments } from '../services/departments.service.js';
import { asyncHandler, ok } from '../utils/http.js';

export const readDepartments = asyncHandler((_req, res) => {
  const payload = listDepartments();
  ok(res, payload.departments, { grid: payload.grid, total: payload.departments.length });
});

export const readDepartment = asyncHandler((req, res) => {
  ok(res, getDepartment(req.params.id));
});
