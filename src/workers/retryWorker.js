
const pool = require('../db/pool');
const { dispatchEvent } = require('../services/dispatcher');

const {
    maxRetryAttempts,
    retryBaseDelaySeconds,
    workerIntervalMs,
    workerBatchSize,
    processingLeaseSeconds,
} = require('../config');

async function claimEvents() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `SELECT
                e.id,
                e.event_id,
                e.payload,
                e.attempts,
                o.is_vip
             FROM events e
             JOIN orders o ON o.event_id = e.id
             WHERE
                (
                    e.status = 'pending'
                    AND e.next_attempt_at <= now()
                )
                OR
                (
                    e.status = 'processing'
                    AND e.processing_started_at <=
                        now() - ($2 * interval '1 second')
                )
             ORDER BY e.next_attempt_at, e.id
             LIMIT $1
             FOR UPDATE OF e SKIP LOCKED`,
            [workerBatchSize, processingLeaseSeconds]
        );

        const events = result.rows;

        if (events.length > 0) {
            const ids = events.map((event) => event.id);

            await client.query(
                `UPDATE events
                 SET
                    status = 'processing',
                    processing_started_at = now()
                 WHERE id = ANY($1::bigint[])`,
                [ids]
            );
        }

        await client.query('COMMIT');

        return events;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Failed to rollback claim transaction:', rollbackError);
        }

        throw error;
    } finally {
        client.release();
    }
}

async function markAsSent(eventId) {
    await pool.query(
        `UPDATE events
         SET
            status = 'sent',
            sent_at = now(),
            processing_started_at = NULL,
            last_error = NULL
         WHERE id = $1`,
        [eventId]
    );
}

async function markAsFailed(event, error) {
    const attempts = event.attempts + 1;
    const permanentlyFailed = attempts >= maxRetryAttempts;

    // 10, 20, 40, 80, 160 sekund przy domyślnym progu.
    const delaySeconds =
        retryBaseDelaySeconds * (2 ** (attempts - 1));

    const status = permanentlyFailed ? 'failed' : 'pending';

    await pool.query(
        `UPDATE events
         SET
            status = $2,
            attempts = $3,
            next_attempt_at = now() + ($4 * interval '1 second'),
            processing_started_at = NULL,
            last_error = $5
         WHERE id = $1`,
        [
            event.id,
            status,
            attempts,
            delaySeconds,
            String(error.message || error).slice(0, 2000),
        ]
    );
}

async function processEvent(event) {
    try {
        await dispatchEvent(event);
    } catch (error) {
        console.error(`Event ${event.event_id} delivery failed:`, error);

        await markAsFailed(event, error);
        return;
    }

    await markAsSent(event.id);

    console.info(`Event ${event.event_id} successfully sent`);
}

async function runWorkerOnce() {
    const events = await claimEvents();

    if (events.length === 0) {
        return 0;
    }

    const results = await Promise.allSettled(
        events.map(processEvent)
    );

    for (const result of results) {
        if (result.status === 'rejected') {
            console.error('Failed to process event:', result.reason);
        }
    }

    return events.length;
}

function startRetryWorker() {
    let currentTick = null;

    async function tick() {
        if (currentTick != null) {
            return;
        }

        currentTick = runWorkerOnce();

        try {
            await currentTick;
        } catch (error) {
            console.error('Retry worker failed:', error);
        } finally {
            currentTick = null;
        }
    }

    function waitForIdle() {
        return currentTick ?? Promise.resolve();
    }

    void tick();

    const interval = setInterval(() => {
        void tick();
    }, workerIntervalMs);

    return () => { clearInterval(interval); return waitForIdle(); };
}

module.exports = {
    runWorkerOnce,
    startRetryWorker,
};
