const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.get("/api/contributions", (req, res) => {
  res.json({ message: "Contribution data will go here" });
});

// Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
