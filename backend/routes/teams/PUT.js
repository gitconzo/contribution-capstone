const router = require("express").Router();
const {TEAMS_PATH} = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");


// edit team name, class code, repo
router.put("/:id", (req, res) =>{
    const teams = readJson(TEAMS_PATH);
    const idx = teams.findIndex(t => t.id === req.params.id);
    if (idx  === -1) return res.status(404).json({error: "Team not found!"});

    const {name, code, repo} = req.body || {};
    if (name) teams[idx].name = name;
    if (code) teams[idx].code = code;
    if (repo) teams[idx].repo = repo;

    writeJson(TEAMS_PATH, teams);
    res.json(teams[idx]);
});

// edit students
router.put("/:id/students/:email", (req, res) => {
    const teams = readJson(TEAMS_PATH);
    const idx = teams.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Team not found!" });

    const studentIdx = teams[idx].students.findIndex(s => s.email === req.params.email);
    if (studentIdx === -1) return res.status(404).json({ error: "Student not found!" });

    const { name, email, github } = req.body || {};
    if (name) teams[idx].students[studentIdx].name = name;
    if (email) teams[idx].students[studentIdx].email = email;
    if (github !== undefined) teams[idx].students[studentIdx].github = github;

    writeJson(TEAMS_PATH, teams);
    res.json(teams[idx]);
});

module.exports = router;