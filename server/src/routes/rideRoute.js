const { Router } = require('express');
const { matchRides, createRide, myRides, getRide } = require('../controllers/rideController');

const router = Router();

router.get('/match', matchRides);
router.get('/mine', myRides);
router.get('/:id', getRide);
router.post('/', createRide);

module.exports = router;
