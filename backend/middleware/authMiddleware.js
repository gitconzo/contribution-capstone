const fs = require("fs");
const path = require("path");

const USERS_PATH = path.join(__dirname, "../data/users.json");

function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token." });
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token.startsWith("demo-token-")) {
      return res.status(401).json({ message: "Invalid token." });
    }

    const parts = token.split("-");
    const userId = Number(parts[2]);

    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Protect middleware error:", error);
    return res.status(500).json({ message: "Server error." });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    next();
  };
}

module.exports = {
  protect,
  authorizeRoles,
};