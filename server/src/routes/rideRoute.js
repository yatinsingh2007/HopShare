const { Router } = require('express');
const { matchRides, createRide, myRides, getRide, markBooked } = require('../controllers/rideController');
const { pickedUp, setFare, claimPayment, confirmPayment } = require('../controllers/fareController');
const { startShare, stopShare } = require('../controllers/safetyController');
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
router.post('/:id/booked', markBooked);
router.post('/:id/picked-up', pickedUp);
router.post('/:id/share', startShare);
router.delete('/:id/share', stopShare);
router.post('/:id/fare', setFare);
router.post('/:id/payments/:paymentId/claim', claimPayment);
router.post('/:id/payments/:paymentId/confirm', confirmPayment);
router.post('/:id/requests', requestToJoin);
router.get('/:id/requests', listRequests);
router.post('/:id/requests/:requestId/accept', acceptRequest);
router.post('/:id/requests/:requestId/reject', rejectRequest);
router.post('/:id/requests/:requestId/cancel', cancelRequest);

module.exports = router;
