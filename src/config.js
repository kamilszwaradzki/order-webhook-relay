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

module.exports = {
    webhookSecret: process.env.WEBHOOK_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT) || 3000,
    vipThreshold,
};