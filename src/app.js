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

module.exports = app;