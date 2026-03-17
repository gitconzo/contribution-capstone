// backend/utils/db.js
// PostgreSQL connection pool — import this wherever you need to query the database.
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, "../certs/global-bundle.pem")),
  },
});

module.exports = pool;
