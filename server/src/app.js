const express = require('express');
const { clerkMiddleware } = require('@clerk/express');
const { requireUser } = require('./middleware/requireUser');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const meRoute = require('./routes/meRoute');

const app = express();

app.use(express.json());
// Reads the Clerk session token from the Authorization header, if one is sent.
app.use(clerkMiddleware());

app.get('/', (req, res) => res.json({ success: true, message: 'Server is running' }));

// Everything below needs a signed-in rider.
app.use('/api/me', requireUser, meRoute);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
