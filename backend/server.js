const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5002;

app.use(cors());

// Root route test
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// API route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Node.js backend!" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
