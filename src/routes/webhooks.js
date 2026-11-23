
const express = require('express');
const verifySignature = require('../middleware/verifySignature');

const router = express.Router();

router.post(
    '/orders',
    express.raw({ type: 'application/json' }),
    verifySignature,
    (req, res) => {
        res.sendStatus(202);
    }
);

module.exports = router;
