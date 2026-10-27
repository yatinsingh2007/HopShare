export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
};
