const crypto = require('node:crypto');
const { webhookSecret } = require('../config');

function verifySignature(req, res, next) {
    const signature = req.headers['x-signature'];

    if (!signature || !Buffer.isBuffer(req.body)) {
        return res.status(401).json({
            error: 'invalid signature',
        });
    }

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body)
        .digest();

    const receivedSignature = Buffer.from(signature, 'base64');

    if (receivedSignature.length !== expectedSignature.length) {
        return res.status(401).json({
            error: 'invalid signature',
        });
    }

    const isValid = crypto.timingSafeEqual(
        receivedSignature,
        expectedSignature
    );

    if (!isValid) {
        return res.status(401).json({
            error: 'invalid signature',
        });
    }

    next();
}

module.exports = verifySignature;
