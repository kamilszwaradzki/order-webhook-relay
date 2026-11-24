const express = require('express');
const verifySignature = require('../middleware/verifySignature');
const { orderEventSchema } = require('../schemas/orderEvent');
const { handleOrderCreated } = require('../services/orderService');

const router = express.Router();

router.post(
    '/orders',
    express.raw({ type: 'application/json' }),
    verifySignature,
    async (req, res, next) => {
        let payload;

        // 1. Parsowanie JSON dopiero po weryfikacji podpisu.
        try {
            payload = JSON.parse(req.body.toString('utf8'));
        } catch {
            return res.status(400).json({
                error: 'invalid JSON',
            });
        }

        // 2. Walidacja struktury i danych.
        const validation = orderEventSchema.safeParse(payload);

        if (!validation.success) {
            return res.status(400).json({
                error: 'validation failed',
                details: validation.error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
        }

        // 3. Przekazanie danych do logiki biznesowej.
        try {
            const result = await handleOrderCreated(payload, validation.data);

            if (result.duplicate) {
                return res.sendStatus(200);
            }

            return res.sendStatus(202);
        } catch (error) {
            return next(error);
        }
    }
);

module.exports = router;
