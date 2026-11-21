const { Router } = require('express');
const { matchRides, createRide, myRides, getRide } = require('../controllers/rideController');
const {
  requestToJoin,
  listRequests,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  myRequests,
} = require('../controllers/requestController');

const router = Router();

router.get('/match', matchRides);
router.get('/mine', myRides);
router.get('/requests/mine', myRequests);
router.get('/:id', getRide);
router.post('/', createRide);
router.post('/:id/requests', requestToJoin);
router.get('/:id/requests', listRequests);
router.post('/:id/requests/:requestId/accept', acceptRequest);
router.post('/:id/requests/:requestId/reject', rejectRequest);
router.post('/:id/requests/:requestId/cancel', cancelRequest);

module.exports = router;
