export type Severity = "High" | "Medium" | "Low";

export type JournalEntry = {
  id: string;
  caseId: number;
  createdAt: string; // ISO or display e.g. "2 Feb 2026, 2:30 pm"
  riskLevel: Severity;
  storyContext: string; // e.g. "Story on high building, no caption"
  notes: string;
  actionTaken: string; // e.g. "Reached out", "Monitoring", "Escalated"
};

export type CaseItem = {
  id: number;
  fullName: string;
  igHandle: string;
  severity: Severity;
  tags: string[];
  sentimentAvg3: number; // out of 10
  sentimentLast5: number[]; // last 5 posts, out of 10
  updated: string;
  unread?: number;
};

export const CASES: CaseItem[] = [
  {
    id: 1,
    fullName: "Alyssa Tan",
    igHandle: "@alyssa.tan",
    severity: "High",
    tags: ["tone shift", "missed check-in"],
    sentimentAvg3: 2.8,
    sentimentLast5: [3.2, 2.6, 2.1, 3.0, 2.8],
    updated: "2h ago",
    unread: 1,
  },
  {
    id: 2,
    fullName: "Marcus Lim",
    igHandle: "@marcuslim",
    severity: "Medium",
    tags: ["withdrawal cues"],
    sentimentAvg3: 5.6,
    sentimentLast5: [6.1, 5.8, 5.2, 5.9, 5.6],
    updated: "5h ago",
    unread: 0,
  },
  {
    id: 3,
    fullName: "Nur Aisyah",
    igHandle: "@aisyah.n",
    severity: "Low",
    tags: ["routine review"],
    sentimentAvg3: 7.9,
    sentimentLast5: [8.1, 7.6, 7.8, 8.0, 7.9],
    updated: "1d ago",
    unread: 2,
  },
];

export const CASE_JOURNAL_ENTRIES: Record<number, JournalEntry[]> = {
  1: [
    {
      id: "j1",
      caseId: 1,
      createdAt: "1 Feb 2026, 10:15 am",
      riskLevel: "High",
      storyContext: "Posts mentioning low mood and isolation over several days.",
      notes: "User has history of expressing hopelessness. Building context for future flags.",
      actionTaken: "Monitoring",
    },
    {
      id: "j2",
      caseId: 1,
      createdAt: "5 Feb 2026, 3:45 pm",
      riskLevel: "High",
      storyContext: "Story on high building rooftop, no caption.",
      notes: "Without journal context would have dismissed as casual. Given history of suicidal tendencies, flagged and reaching out.",
      actionTaken: "Reached out",
    },
  ],
  2: [
    {
      id: "j3",
      caseId: 2,
      createdAt: "4 Feb 2026, 11:00 am",
      riskLevel: "Medium",
      storyContext: "Stopped replying to DMs, stories show mostly at home.",
      notes: "Withdrawal cues. Logging for pattern.",
      actionTaken: "Monitoring",
    },
  ],
  3: [],
};
