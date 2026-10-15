/** Investigacion de mercado. */
import { RESEARCH_TYPES } from '../mocks/index.js';
import { getResearch, getResearchSummary, listResearch } from '../services/research.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parsePagination } from '../utils/validate.js';

export const readResearch = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listResearch({
    type: parseEnum(req.query.type, RESEARCH_TYPES, 'type'),
    status: parseEnum(req.query.status, ['published', 'draft'], 'status'),
    productId: req.query.productId,
    search: req.query.search,
    sort: parseEnum(req.query.sort, ['recent', 'title', 'type'], 'sort', 'recent'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { types: RESEARCH_TYPES } },
  });
});

export const readResearchSummary = asyncHandler((_req, res) => {
  ok(res, getResearchSummary());
});

export const readResearchById = asyncHandler((req, res) => {
  ok(res, getResearch(req.params.id));
});
