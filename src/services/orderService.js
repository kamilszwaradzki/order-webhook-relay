const pool = require('../db/pool');
const { vipThreshold } = require('../config');

function decimalToGrosze(value) {
    const [whole, fraction = ''] = value.split('.');

    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

async function handleOrderCreated(rawPayload, event) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const eventResult = await client.query(
            `INSERT INTO events (event_id, type, payload)
            VALUES ($1, $2, $3)
            ON CONFLICT (event_id) DO NOTHING
            RETURNING id`,
            [
                event.event_id,
                event.type,
                rawPayload,
            ]
        );

        // Zdarzenie o takim ID już istnieje.
        if (eventResult.rowCount === 0) {
            await client.query('ROLLBACK');

            return { duplicate: true };
        }

        const eventDbId = eventResult.rows[0].id;

        // Porównujemy kwoty jako całkowite grosze, bez floatów.
        const totalInGrosze = decimalToGrosze(event.data.total);
        const thresholdInGrosze = decimalToGrosze(vipThreshold);

        const isVip =
            event.data.currency === 'PLN' &&
            totalInGrosze > thresholdInGrosze;

        const orderResult = await client.query(
            `INSERT INTO orders (
                external_id,
                event_id,
                customer_email,
                total_amount,
                currency,
                is_vip
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (external_id) DO NOTHING`,
            [
                event.data.order_id,
                eventDbId,
                event.data.customer_email,
                event.data.total,
                event.data.currency,
                isVip,
            ]
        );

        if (orderResult.rowCount === 0) {
            await client.query(
                `UPDATE events
                SET status = 'skipped'
                WHERE id = $1`,
                [eventDbId]
            );
        }

        await client.query('COMMIT');

        return { duplicate: false };
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Transaction rollback failed:', rollbackError);
        }

        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    handleOrderCreated,
};