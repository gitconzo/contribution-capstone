const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const usersFilePath = path.join(__dirname, "data", "users.json");

async function test() {
  const data = fs.readFileSync(usersFilePath, "utf-8");
  const users = JSON.parse(data);

  const teacher = users.find((u) => u.email === "lecturer@university.edu");
  const student = users.find((u) => u.email === "student@university.edu");

  const teacherMatch = await bcrypt.compare("123456", teacher.password);
  const studentMatch = await bcrypt.compare("123456", student.password);

  console.log("Teacher password match:", teacherMatch);
  console.log("Student password match:", studentMatch);
}

test();