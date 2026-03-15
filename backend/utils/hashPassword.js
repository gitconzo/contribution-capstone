const bcrypt = require("bcryptjs");

async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

function isHashed(password = "") {
  return typeof password === "string" && password.startsWith("$2");
}

module.exports = {
  hashPassword,
  comparePassword,
  isHashed,
};