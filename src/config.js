const dotenv = require('dotenv');

dotenv.config();

const requiredEnv = ['WEBHOOK_SECRET', 'DATABASE_URL'];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

const vipThreshold = process.env.VIP_THRESHOLD ?? '1000.00';

if (!/^\d{1,8}(\.\d{1,2})?$/.test(vipThreshold)) {
    throw new Error(
        'VIP_THRESHOLD must be a decimal string with up to 8 integer digits and 2 decimal places'
    );
}

const webhookUrl = process.env.DOWNSTREAM_URL;
const vipWebhookUrl = process.env.DOWNSTREAM_VIP_URL;

if (!webhookUrl || !vipWebhookUrl) {
    throw new Error('DOWNSTREAM_URL and DOWNSTREAM_VIP_URL are required');
}

const dispatchTimeoutMs = Number(
    process.env.DISPATCH_TIMEOUT_MS ?? 5000
);

if (!Number.isInteger(dispatchTimeoutMs) || dispatchTimeoutMs <= 0) {
    throw new Error('DISPATCH_TIMEOUT_MS must be a positive integer');
}

const maxRetryAttempts = Number(
    process.env.MAX_RETRY_ATTEMPTS ?? 5
);

const retryBaseDelaySeconds = Number(
    process.env.RETRY_BASE_DELAY_SECONDS ?? 10
);

const workerIntervalMs = Number(
    process.env.WORKER_INTERVAL_MS ?? 5000
);

const workerBatchSize = Number(
    process.env.WORKER_BATCH_SIZE ?? 10
);

const processingLeaseSeconds = Number(
    process.env.PROCESSING_LEASE_SECONDS ?? 120
);

const positiveIntegers = {
    maxRetryAttempts,
    retryBaseDelaySeconds,
    workerIntervalMs,
    workerBatchSize,
    processingLeaseSeconds,
};

for (const [name, value] of Object.entries(positiveIntegers)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
}

if ( processingLeaseSeconds * 1000 <= dispatchTimeoutMs ) {
    throw new Error('PROCESSING_LEASE_SECONDS must be a greater than DISPATCH_TIMEOUT_MS.');
}
module.exports = {
    webhookSecret: process.env.WEBHOOK_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT) || 3000,

    webhookUrl,
    vipWebhookUrl,
    dispatchTimeoutMs,
    vipThreshold,

    maxRetryAttempts,
    retryBaseDelaySeconds,
    workerIntervalMs,
    workerBatchSize,
    processingLeaseSeconds,
};