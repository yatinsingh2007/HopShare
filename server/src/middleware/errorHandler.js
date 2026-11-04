/** Every error leaves the API in the same shape: { success: false, message }. */
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
};

// Express needs all four arguments to treat this as the error handler.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Something went wrong. Please try again.' : err.message,
  });
};

module.exports = { notFound, errorHandler };
