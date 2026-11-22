const express = require('express');
const cookieParser = require('cookie-parser');
const { requireUser } = require('./middleware/requireUser');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const authRoute = require('./routes/authRoute');
const meRoute = require('./routes/meRoute');
const rideRoute = require('./routes/rideRoute');
const { publicTrip, tripPage } = require('./controllers/safetyController');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => res.json({ success: true, message: 'Server is running' }));

// public trip-share link: anyone with the link, no sign-in
app.get('/trip/:token', tripPage);
app.get('/api/trip/:token', publicTrip);

app.use('/api/auth', authRoute);
app.use('/api/me', requireUser, meRoute);
app.use('/api/rides', requireUser, rideRoute);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
