/** Contenido y creatividades. */
import { CONTENT_STATUSES, CONTENT_TYPES, CREATIVE_FORMATS } from '../mocks/index.js';
import {
  getContent,
  getContentSummary,
  getCreative,
  listContent,
  listContentTypes,
  listCreativeFormats,
  listCreatives,
} from '../services/content.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parsePagination } from '../utils/validate.js';

export const readContent = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listContent({
    type: parseEnum(req.query.type, CONTENT_TYPES, 'type'),
    status: parseEnum(req.query.status, CONTENT_STATUSES, 'status'),
    channel: req.query.channel,
    search: req.query.search,
    sort: parseEnum(req.query.sort, ['recent', 'impressions', 'conversions', 'title'], 'sort', 'recent'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { types: listContentTypes(), statuses: CONTENT_STATUSES } },
  });
});

export const readContentItem = asyncHandler((req, res) => {
  ok(res, getContent(req.params.id));
});

export const readCreatives = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listCreatives({
    format: parseEnum(req.query.format, CREATIVE_FORMATS, 'format'),
    status: req.query.status,
    campaignId: req.query.campaignId,
    search: req.query.search,
    sort: parseEnum(req.query.sort, ['impressions', 'conversions', 'recent', 'name'], 'sort', 'impressions'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { formats: listCreativeFormats(), statuses: ['draft', 'approved', 'live'] } },
  });
});

export const readCreative = asyncHandler((req, res) => {
  ok(res, getCreative(req.params.id));
});

export const readContentSummary = asyncHandler((_req, res) => {
  ok(res, getContentSummary());
});
