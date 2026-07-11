import type { Request } from 'express';
import { paginationQuery, type PaginationQuery } from '@clinicos/validation';

export interface Pagination extends PaginationQuery {
  skip: number;
}

export function parsePagination(req: Request): Pagination {
  const parsed = paginationQuery.parse(req.query);
  return { ...parsed, skip: (parsed.page - 1) * parsed.limit };
}
