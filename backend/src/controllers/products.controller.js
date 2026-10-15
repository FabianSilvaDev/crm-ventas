/** Productos y ofertas. */
import { OFFER_STATUSES, PRODUCT_STATUSES } from '../mocks/index.js';
import {
  getOffer,
  getProduct,
  listCategories,
  listOffers,
  listProducts,
  serializeOffer,
  serializeProduct,
} from '../services/products.service.js';
import { asyncHandler, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parsePagination } from '../utils/validate.js';

const PRODUCT_SORTS = ['revenue', 'score', 'margin', 'name', 'updated'];

export const readProducts = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listProducts({
    status: parseEnum(req.query.status, PRODUCT_STATUSES, 'status'),
    category: req.query.category,
    search: req.query.search,
    sort: parseEnum(req.query.sort, PRODUCT_SORTS, 'sort', 'revenue'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: {
      filters: {
        statuses: PRODUCT_STATUSES,
        categories: listCategories(),
        sorts: PRODUCT_SORTS,
      },
    },
  });
});

export const readProduct = asyncHandler((req, res) => {
  ok(res, getProduct(req.params.id));
});

export const readOffers = asyncHandler((req, res) => {
  const pagination = parsePagination(req.query);
  const items = listOffers({
    status: parseEnum(req.query.status, OFFER_STATUSES, 'status'),
    productId: req.query.productId,
    search: req.query.search,
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { statuses: OFFER_STATUSES } },
  });
});

export const readOffer = asyncHandler((req, res) => {
  ok(res, getOffer(req.params.id));
});

/** Resumen usado por las tarjetas de la vista de productos. */
export const readProductHighlights = asyncHandler((_req, res) => {
  ok(res, {
    products: listProducts({}).slice(0, 3).map((product) => serializeProduct(product)),
    offers: listOffers({ status: 'active' }).slice(0, 3).map((offer) => serializeOffer(offer)),
  });
});
