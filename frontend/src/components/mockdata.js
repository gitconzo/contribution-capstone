export const mockProjects = [
  {
    id: "proj-1",
    name: "COS40005-Computing Technology Project A - Sprint 1",
    description:
      "Sprint 1: Project setup, requirements analysis, and initial development phase with team formation and technology stack selection",
    startDate: "2025-08-04",
    endDate: "2025-08-18",
    students: ["student-1", "student-2", "student-3", "student-4", "student-5"],
  },
  {
    id: "proj-2",
    name: "COS40005-Computing Technology Project A - Sprint 2",
    description:
      "Sprint 2: Core development phase with feature implementation, testing, and code reviews",
    startDate: "2025-08-19",
    endDate: "2025-09-15",
    students: ["student-1", "student-2", "student-3", "student-4", "student-5"],
  },
  {
    id: "proj-3",
    name: "COS40005-Computing Technology Project A - Sprint 3",
    description:
      "Sprint 3: Final implementation, integration testing, deployment, and project documentation completion",
    startDate: "2025-09-16",
    endDate: "2025-10-03",
    students: ["student-1", "student-2", "student-3", "student-4", "student-5"],
  },
];

export const mockStudents = [
  {
    id: "student-1",
    name: "Jen Mao",
    email: "103821194@student.swin.edu.au",
    overallScore: 92,
    contributionLevel: "high",
    metrics: {
      codeCommits: 45,
      worklogHours: 120,
      documentsCreated: 8,
      meetingsAttended: 12,
    },
    timeline: [
      { date: "2025-08-05", activity: "Initial project setup", type: "code", impact: 85 },
      { date: "2025-08-12", activity: "Database design document", type: "document", impact: 90 },
      { date: "2025-08-19", activity: "Planning meeting", type: "meeting", impact: 80 },
      { date: "2025-08-26", activity: "User authentication implementation", type: "code", impact: 95 },
      { date: "2025-09-16", activity: "API development work", type: "worklog", impact: 88 },
    ],
  },
  {
    id: "student-2",
    name: "Connor Lack",
    email: "103992223@student.swin.edu.au",
    overallScore: 89,
    contributionLevel: "high",
    metrics: {
      codeCommits: 42,
      worklogHours: 115,
      documentsCreated: 7,
      meetingsAttended: 11,
    },
    timeline: [
      { date: "2025-08-08", activity: "Frontend components", type: "code", impact: 85 },
      { date: "2025-08-15", activity: "UI mockups", type: "document", impact: 88 },
      { date: "2025-08-22", activity: "Team standup", type: "meeting", impact: 82 },
      { date: "2025-08-29", activity: "CSS styling work", type: "worklog", impact: 90 },
    ],
  },
  {
    id: "student-3",
    name: "Jason Vo",
    email: "103993653@student.swin.edu.au",
    overallScore: 94,
    contributionLevel: "high",
    metrics: {
      codeCommits: 52,
      worklogHours: 140,
      documentsCreated: 12,
      meetingsAttended: 14,
    },
    timeline: [
      { date: "2025-08-04", activity: "Project architecture design", type: "document", impact: 95 },
      { date: "2025-08-11", activity: "Core backend services", type: "code", impact: 92 },
      { date: "2025-08-20", activity: "Technical review meeting", type: "meeting", impact: 90 },
      { date: "2025-08-27", activity: "Testing framework setup", type: "code", impact: 88 },
    ],
  },
  {
    id: "student-4",
    name: "Kavindu Bhanuka Weragoda",
    email: "104860525@student.swin.edu.au",
    overallScore: 73,
    contributionLevel: "medium",
    metrics: {
      codeCommits: 15,
      worklogHours: 60,
      documentsCreated: 2,
      meetingsAttended: 6,
    },
    timeline: [
      { date: "2025-08-10", activity: "CSS styling contributions", type: "code", impact: 70 },
      { date: "2025-08-17", activity: "Meeting attendance", type: "meeting", impact: 75 },
      { date: "2025-08-28", activity: "Documentation update", type: "document", impact: 78 },
    ],
  },
  {
    id: "student-5",
    name: "Md Hridoy Mia",
    email: "105077229@student.swin.edu.au",
    overallScore: 58,
    contributionLevel: "low",
    metrics: {
      codeCommits: 33,
      worklogHours: 105,
      documentsCreated: 6,
      meetingsAttended: 10,
    },
    timeline: [
      { date: "2025-08-07", activity: "Basic UI components", type: "code", impact: 58 },
      { date: "2025-08-14", activity: "Documentation attempt", type: "document", impact: 52 },
      { date: "2025-08-25", activity: "Meeting attendance", type: "meeting", impact: 55 },
    ],
  },
];

// optional: mock rules (for Rule Settings page if needed)
export const mockRules = [
  {
    id: "rule-1",
    name: "Code Commits",
    weight: 30,
    description: "Weight given to Git commits and code quality",
    category: "code",
  },
  {
    id: "rule-2",
    name: "Work Log Hours",
    weight: 25,
    description: "Time spent on project tasks as logged",
    category: "worklog",
  },
  {
    id: "rule-3",
    name: "Documentation",
    weight: 20,
    description: "Documents created and maintained",
    category: "document",
  },
  {
    id: "rule-4",
    name: "Meeting Participation",
    weight: 15,
    description: "Attendance and participation in team meetings",
    category: "meeting",
  },
];

// helper color utilities (optional if you need for details view)
export const getScoreColor = (score) => {
  if (score >= 90) return "text-green-700";
  if (score >= 80) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
};