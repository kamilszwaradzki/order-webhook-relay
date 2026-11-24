const express = require('express');
const pool = require('./db/pool');
const webhooksRouter = require('./routes/webhooks');

const app = express();

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        res.status(200).json({
            status: 'ok',
            database: 'connected',
        });
    } catch (error) {
        console.error('Health check failed:', error.message);

        res.status(503).json({
            status: 'error',
            database: 'disconnected',
        });
    }
});

app.use('/webhooks', webhooksRouter);

app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({
        error: 'internal server error',
    });
});

module.exports = app;