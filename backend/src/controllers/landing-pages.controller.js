/** Landing pages y experimentos de conversion. */
import { LANDING_STATUSES } from '../mocks/index.js';
import { getLandingPage, getLandingSummary, listLandingPages } from '../services/landing-pages.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parsePagination } from '../utils/validate.js';

export const readLandingPages = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listLandingPages({
    status: parseEnum(req.query.status, LANDING_STATUSES, 'status'),
    template: req.query.template,
    search: req.query.search,
    sort: parseEnum(req.query.sort, ['visitors', 'conversionRate', 'seo', 'recent', 'title'], 'sort', 'visitors'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { statuses: LANDING_STATUSES } },
  });
});

export const readLandingSummary = asyncHandler((_req, res) => {
  ok(res, getLandingSummary());
});

export const readLandingPageById = asyncHandler((req, res) => {
  ok(res, getLandingPage(req.params.id));
});
