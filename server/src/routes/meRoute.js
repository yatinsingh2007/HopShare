const { Router } = require('express');
const { getMe, updateMe, myActivity, readActivity } = require('../controllers/meController');
const { myPayments } = require('../controllers/fareController');
const { listContacts, addContact, removeContact, sos } = require('../controllers/safetyController');

const router = Router();

router.get('/', getMe);
router.patch('/', updateMe);
router.get('/payments', myPayments);
router.get('/activity', myActivity);
router.post('/activity/read', readActivity);
router.get('/contacts', listContacts);
router.post('/contacts', addContact);
router.delete('/contacts/:contactId', removeContact);
router.post('/sos', sos);

module.exports = router;
