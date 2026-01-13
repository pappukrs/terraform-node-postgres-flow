const { Pool } = require('pg');
require('dotenv').config();

let dbUrl = process.env.DATABASE_URL;

const poolConfig = {
    connectionString: dbUrl,
};

// AWS RDS requires SSL. We force it in production or if requested via URL.
if (process.env.NODE_ENV === 'production' || (dbUrl && dbUrl.includes('sslmode'))) {
    // Strip query parameters to prevent conflicts with the explicit ssl object in some 'pg' versions
    if (dbUrl && dbUrl.includes('?')) {
        poolConfig.connectionString = dbUrl.split('?')[0];
    }
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(poolConfig);

module.exports = {
    query: (text, params) => pool.query(text, params),
};
