const express = require('express');
const { requireUser } = require('./middleware/requireUser');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const authRoute = require('./routes/authRoute');
const meRoute = require('./routes/meRoute');

const app = express();

app.use(express.json());

app.get('/', (req, res) => res.json({ success: true, message: 'Server is running' }));

app.use('/api/auth', authRoute);
app.use('/api/me', requireUser, meRoute);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
