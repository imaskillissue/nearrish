require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log('Connected to Postgres!');
    return client.end();
  })
  .catch(err => {
    console.error('Connection error:', err.stack);
  });