const router = require("express").Router();
const { TEAMS_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");
const { readActiveId, writeActiveId } = require("../../utils/activeTeamUtils");

// DELETE /api/teams/:id — deleting a team
router.delete("/:id", (req, res) => {
  let teams = readJson(TEAMS_PATH);
  if (!teams.find(t => t.id === req.params.id)) {
    return res.status(404).json({ error: "Team not found" });
  }
 
  teams = teams.filter(t => t.id !== req.params.id);
  writeJson(TEAMS_PATH, teams);
 
  //if active, clear active team
  if (readActiveId() === req.params.id) {
    writeActiveId(teams[0]?.id || null);
  }
 
  res.json({ success: true });
});

// DELETE /api/teams/:id/students/:email — removing a student
router.delete("/:id/students/:email", (req, res) => {
  const teams = readJson(TEAMS_PATH);
  const team = teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
 
  const before = team.students.length;
  team.students = team.students.filter(s => s.email !== req.params.email);
 
  if (team.students.length === before) {
    return res.status(404).json({ error: "Student not found" });
  }
 
  writeJson(TEAMS_PATH, teams);
  res.json(team);
});
 
module.exports = router;