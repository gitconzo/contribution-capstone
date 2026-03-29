// backend/services/studentMatcher.js
// Builds a lookup map from every name a student might appear as
// (name, email, github username, aliases) so authors in Git/docs can be matched to a student record

function buildAliasMap(team) {
  const map = new Map();

  team.students.forEach((student, index) => {
    const variants = new Set(
      [student.name, student.email, student.github, ...(student.aliases || [])]
        .filter(Boolean)
        .map(value => String(value).toLowerCase().trim())
    );

    for (const variant of variants) {
      map.set(variant, index);
    }
  });

  return map;
}

// Returns the index of the student matching the given key, or -1 if no match found
// Tries a direct match first, then strips parentheticals like "(Leader)" and tries again
function matchStudentIndex(aliasMap, key) {
  if (!key) return -1;

  const normalised = String(key).toLowerCase().trim();

  if (aliasMap.has(normalised)) return aliasMap.get(normalised);

  const withoutParentheticals = normalised.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (aliasMap.has(withoutParentheticals)) return aliasMap.get(withoutParentheticals);

  return -1;
}

module.exports = { buildAliasMap, matchStudentIndex };
