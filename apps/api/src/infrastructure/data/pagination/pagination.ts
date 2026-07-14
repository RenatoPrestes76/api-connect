/**
 * Generic pagination helpers — shared by any future repository or route,
 * independent of any specific entity.
 */
export interface PageRequest {
  readonly page: number; // 1-based
  readonly pageSize: number;
}

export interface PageResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Clamps page/pageSize to sane bounds — never trusts raw client input directly. */
export function normalizePageRequest(request: Partial<PageRequest>): PageRequest {
  const page = Math.max(1, Math.floor(request.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(request.pageSize ?? DEFAULT_PAGE_SIZE))
  );
  return { page, pageSize };
}

/** Converts a 1-based PageRequest into Prisma-style skip/take. */
export function toSkipTake(request: PageRequest): { skip: number; take: number } {
  return { skip: (request.page - 1) * request.pageSize, take: request.pageSize };
}

export function buildPageResult<T>(items: T[], total: number, request: PageRequest): PageResult<T> {
  return {
    items,
    total,
    page: request.page,
    pageSize: request.pageSize,
    totalPages: Math.ceil(total / request.pageSize),
  };
}
