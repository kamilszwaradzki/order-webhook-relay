const request = require('supertest');
const crypto = require('node:crypto');
const pool = require('../db/pool');
const app = require('../app');
const { webhookSecret } = require('../config');

function sign(bodyString) {
  return crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyString)
    .digest('base64');
}

function makeEvent({ eventId = 'evt-1', orderId = 'ORD-1042', total = '1299.00', ...rest } = {}) {
  return {
    event_id: eventId,
    type: 'order.created',
    data: {
      order_id: orderId,
      customer_email: 'test@example.com',
      total,
      currency: 'PLN',
      ...rest,
    },
  };
}

function postWebhook(payload, { signature } = {}) {
  const bodyString = JSON.stringify(payload);
  const sig = signature ?? sign(bodyString);

  return request(app)
    .post('/webhooks/orders')
    .set('Content-Type', 'application/json')
    .set('X-Signature', sig)
    .send(bodyString);
}

beforeAll(async () => {
  const { rows } = await pool.query('SELECT current_database()');
  if (!rows[0].current_database.endsWith('_test')) {
    throw new Error('Refusing to run tests against non-test database');
  }
});

beforeEach(async () => {
  await pool.query('TRUNCATE orders, events RESTART IDENTITY');
});

afterAll(async () => {
  await pool.end();
});

describe('POST /webhooks/orders', () => {
  test('1. przyjmuje poprawny webhook (202) i zapisuje event + order', async () => {
    const event = makeEvent();

    const res = await postWebhook(event);
    expect(res.status).toBe(202);

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(1);
    expect(events.rows[0].event_id).toBe('evt-1');
    expect(events.rows[0].type).toBe('order.created');
    expect(events.rows[0].status).toBe('pending');

    const orders = await pool.query('SELECT * FROM orders');
    expect(orders.rowCount).toBe(1);
    expect(orders.rows[0].external_id).toBe('ORD-1042');
    expect(orders.rows[0].customer_email).toBe('test@example.com');
    expect(orders.rows[0].total_amount).toBe('1299.00');
    expect(orders.rows[0].currency).toBe('PLN');
    expect(orders.rows[0].event_id).toBe(events.rows[0].id);
  });

  test('2. duplikat event_id → 200 bez body, bez drugiego rekordu', async () => {
    const event = makeEvent({ eventId: 'evt-dup' });

    const first = await postWebhook(event);
    expect(first.status).toBe(202);

    const second = await postWebhook(event);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({});

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(1);

    const orders = await pool.query('SELECT * FROM orders');
    expect(orders.rowCount).toBe(1);
  });

  test('3. nieprawidłowy podpis → 401', async () => {
    const event = makeEvent();

    const res = await postWebhook(event, { signature: 'invalid-signature' });
    expect(res.status).toBe(401);

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(0);
  });

  test('4. brak podpisu → 401', async () => {
    const event = makeEvent();
    const bodyString = JSON.stringify(event);

    const res = await request(app)
      .post('/webhooks/orders')
      .set('Content-Type', 'application/json')
      .send(bodyString);

    expect(res.status).toBe(401);

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(0);
  });

  test('5. niepoprawny payload (zły email) → 400 z details', async () => {
    const invalid = makeEvent({ customer_email: 'not-an-email' });

    const res = await postWebhook(invalid);
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(0);
  });

  test('6. total poza zakresem → 400', async () => {
    const invalid = makeEvent({ total: '123456789.00' });

    const res = await postWebhook(invalid);
    expect(res.status).toBe(400);

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(0);
  });

  test('7. total jako liczba (nie string) → 400', async () => {
    const invalid = makeEvent({ total: 1299 });

    const res = await postWebhook(invalid);
    expect(res.status).toBe(400);

    const events = await pool.query('SELECT * FROM events');
    expect(events.rowCount).toBe(0);
  });
});

describe('reguła VIP', () => {
  test('1299.00 PLN > progu → is_vip = true', async () => {
    const event = makeEvent({ eventId: 'evt-vip-yes', orderId: 'ORD-VIP-YES', total: '1299.00' });

    const res = await postWebhook(event);
    expect(res.status).toBe(202);

    const { rows } = await pool.query(
      'SELECT is_vip FROM orders WHERE external_id = $1',
      ['ORD-VIP-YES']
    );
    expect(rows[0].is_vip).toBe(true);
  });

  test('500.00 PLN <= progu → is_vip = false', async () => {
    const event = makeEvent({ eventId: 'evt-vip-no', orderId: 'ORD-VIP-NO', total: '500.00' });

    const res = await postWebhook(event);
    expect(res.status).toBe(202);

    const { rows } = await pool.query(
      'SELECT is_vip FROM orders WHERE external_id = $1',
      ['ORD-VIP-NO']
    );
    expect(rows[0].is_vip).toBe(false);
  });
});

describe('skipped: nowy event_id dla istniejącego order_id', () => {
  test('event zostaje zapisany jako skipped, order bez zmian', async () => {
    const first = makeEvent({ eventId: 'evt-a', orderId: 'ORD-X' });
    const second = makeEvent({ eventId: 'evt-b', orderId: 'ORD-X' });

    expect((await postWebhook(first)).status).toBe(202);
    expect((await postWebhook(second)).status).toBe(202);

    const events = await pool.query(
      'SELECT event_id, status FROM events ORDER BY id'
    );
    expect(events.rows).toEqual([
      { event_id: 'evt-a', status: 'pending' },
      { event_id: 'evt-b', status: 'skipped' },
    ]);

    const orders = await pool.query('SELECT * FROM orders');
    expect(orders.rowCount).toBe(1);
  });
});