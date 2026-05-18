/**
 * Pagination utility helper
 * Provides consistent pagination across all API endpoints
 */

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @returns {Object} Pagination parameters
 */
const getPaginationParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  // Ensure valid values
  const validPage = page > 0 ? page : 1;
  const validLimit = limit > 0 && limit <= 100 ? limit : 10; // Max 100 items per page
  const validSkip = (validPage - 1) * validLimit;

  return {
    page: validPage,
    limit: validLimit,
    skip: validSkip,
  };
};

/**
 * Build pagination metadata for response
 * @param {Number} total - Total number of documents
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
};

/**
 * Build paginated response
 * @param {Array} data - Array of documents
 * @param {Number} total - Total number of documents
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @returns {Object} Paginated response object
 */
const buildPaginatedResponse = (data, total, page, limit) => {
  return {
    success: true,
    data,
    pagination: buildPaginationMeta(total, page, limit),
  };
};

module.exports = {
  getPaginationParams,
  buildPaginationMeta,
  buildPaginatedResponse,
};
