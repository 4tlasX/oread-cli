/**
 * Express error handling middleware (adapted from chat/middleware/errorHandler.js)
 */

export function errorHandler(err, req, res, _next) {
  // Always log the full error server-side for debugging.
  console.error(`[api] ${req.method} ${req.path}:`, err.message);

  const status = err.statusCode || err.status || 500;
  // Never send internal error details to the client — they can contain file
  // paths, API keys, or other sensitive context. Use generic messages only.
  res.status(status).json({ success: false, error: genericMessage(status) });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function genericMessage(status) {
  return { 400: 'Invalid request', 404: 'Not found', 500: 'Internal server error' }[status] || 'Error';
}

export class NotFoundError extends Error {
  constructor(msg = 'Not found') { super(msg); this.statusCode = 404; }
}
