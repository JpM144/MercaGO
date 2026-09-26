export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  res.status(status).json({
    status: status >= 500 ? 'error' : 'fail',
    message: error.message,
  });
}
