/** Campanas simuladas y su resumen publicitario. */
import { CAMPAIGN_STATUSES } from '../mocks/index.js';
import { getCampaign, getCampaignSummary, listCampaigns, listChannels } from '../services/campaigns.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parsePagination } from '../utils/validate.js';

const SORTS = ['revenue', 'roas', 'spend', 'conversions', 'startDate', 'name'];

export const readCampaigns = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listCampaigns({
    status: parseEnum(req.query.status, CAMPAIGN_STATUSES, 'status'),
    channel: req.query.channel,
    search: req.query.search,
    sort: parseEnum(req.query.sort, SORTS, 'sort', 'revenue'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { statuses: CAMPAIGN_STATUSES, channels: listChannels(), sorts: SORTS } },
  });
});

export const readCampaignSummary = asyncHandler((_req, res) => {
  ok(res, getCampaignSummary());
});

export const readCampaign = asyncHandler((req, res) => {
  ok(res, getCampaign(req.params.id));
});
