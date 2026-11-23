const { Pool } = require('pg');
const { databaseUrl } = require('./config');

const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2000,
});

module.exports = pool;