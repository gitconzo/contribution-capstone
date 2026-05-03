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

    // Cognito JWT — three base64 sections separated by dots
    const parts = token.split(".");
    if (parts.length === 3) {
      let payload;
      try {
        payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      } catch {
        return res.status(401).json({ message: "Invalid token." });
      }

      const email = payload.email;
      if (!email) return res.status(401).json({ message: "Invalid token: no email claim." });

      req.user = {
        email,
        name: payload.name || email,
        role: payload["custom:role"] || "teacher",
      };
      return next();
    }

    // Legacy demo-token format (demo-token-{userId}-{timestamp})
    if (token.startsWith("demo-token-")) {
      const tokenParts = token.split("-");
      const userId = Number(tokenParts[2]);
      const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
      const user = users.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      return next();
    }

    return res.status(401).json({ message: "Invalid token." });
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

module.exports = { protect, authorizeRoles };
