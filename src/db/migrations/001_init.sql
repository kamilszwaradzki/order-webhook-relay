CREATE TABLE events (
    id              BIGSERIAL PRIMARY KEY,
    event_id        TEXT NOT NULL UNIQUE,          -- idempotencja
    type            TEXT NOT NULL,                 -- np. 'order.created'
    payload         JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
    attempts        INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    processing_started_at TIMESTAMPTZ
);
CREATE INDEX idx_events_queue ON events (status, next_attempt_at);

CREATE INDEX idx_events_processing
    ON events (processing_started_at)
    WHERE status = 'processing';

CREATE TABLE orders (
    id              BIGSERIAL PRIMARY KEY,
    external_id     TEXT NOT NULL UNIQUE,          -- ID zamówienia ze sklepu
    event_id        BIGINT NOT NULL REFERENCES events(id),
    customer_email  TEXT NOT NULL,
    total_amount    NUMERIC(10,2) NOT NULL,        -- pieniądze nigdy jako float
    currency        CHAR(3) NOT NULL DEFAULT 'PLN',
    is_vip          BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);