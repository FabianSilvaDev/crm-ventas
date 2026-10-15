/** Leads y ventas simuladas. */
import { LEAD_ORIGINS, LEAD_STATUSES } from '../mocks/index.js';
import { getLead, getLeadsSummary, listLeads } from '../services/leads.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parseIntParam, parsePagination } from '../utils/validate.js';

const SORTS = ['score', 'value', 'recent', 'company'];
const PRIORITIES = ['alta', 'media', 'baja'];

export const readLeads = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listLeads({
    status: parseEnum(req.query.status, LEAD_STATUSES, 'status'),
    origin: parseEnum(req.query.origin, LEAD_ORIGINS, 'origin'),
    priority: parseEnum(req.query.priority, PRIORITIES, 'priority'),
    campaignId: req.query.campaignId,
    offerId: req.query.offerId,
    minScore: parseIntParam(req.query.minScore, 'minScore', { min: 0, max: 100 }),
    search: req.query.search,
    sort: parseEnum(req.query.sort, SORTS, 'sort', 'score'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { statuses: LEAD_STATUSES, origins: LEAD_ORIGINS, priorities: PRIORITIES, sorts: SORTS } },
  });
});

export const readLeadsSummary = asyncHandler((_req, res) => {
  ok(res, getLeadsSummary());
});

export const readLead = asyncHandler((req, res) => {
  ok(res, getLead(req.params.id));
});
