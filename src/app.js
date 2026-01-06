require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// ===============================
// DATABASE CONNECTION
// ===============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===============================
// TEST ROUTE
// ===============================
app.get("/", (req, res) => {
  res.send("Pastebin Backend is running");
});

// ===============================
// CREATE TABLE
// ===============================
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pastes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      expires_at TIMESTAMP,
      max_views INT,
      view_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
})();

// ===============================
// CREATE PASTE
// ===============================
app.post("/paste", async (req, res) => {
  const { content, expiresInMinutes, maxViews } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  const id = Date.now().toString();

  let expiresAt = null;
  if (expiresInMinutes) {
    expiresAt = new Date(Date.now() + expiresInMinutes * 60000);
  }

  await pool.query(
    `INSERT INTO pastes (id, content, expires_at, max_views)
     VALUES ($1, $2, $3, $4)`,
    [id, content, expiresAt, maxViews || null]
  );

  res.status(201).json({
    link: `/paste/${id}`
  });
});

// ===============================
// READ PASTE
// ===============================
app.get("/paste/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT * FROM pastes WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Paste not found" });
  }

  const paste = result.rows[0];

  if (paste.expires_at && paste.expires_at < new Date()) {
    return res.status(410).json({ error: "Paste expired" });
  }

  if (paste.max_views && paste.view_count >= paste.max_views) {
    return res.status(410).json({ error: "Paste expired" });
  }

  await pool.query(
    `UPDATE pastes SET view_count = view_count + 1 WHERE id = $1`,
    [id]
  );

  res.json({ content: paste.content });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
