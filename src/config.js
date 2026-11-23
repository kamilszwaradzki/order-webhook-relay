const dotenv = require('dotenv');

dotenv.config();

const requiredEnv = ['WEBHOOK_SECRET', 'DATABASE_URL'];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

module.exports = {
    webhookSecret: process.env.WEBHOOK_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT) || 3000,
};