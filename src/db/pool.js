const { Pool } = require('pg');
const { databaseUrl } = require('../config');

const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
});

module.exports = pool;
