"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CASES,
  CASE_JOURNAL_ENTRIES,
  type CaseItem,
  type JournalEntry,
  type Severity,
} from "@/lib/mock-data";

function severityPillClass(severity: Severity) {
  switch (severity) {
    case "High":
      return "bg-red-600 text-white hover:bg-red-600";
    case "Medium":
      return "bg-orange-500 text-white hover:bg-orange-500";
    case "Low":
      return "bg-green-600 text-white hover:bg-green-600";
  }
}

export default function CaseDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? parseInt(params.id, 10) : NaN;
  const caseItem = CASES.find((c) => c.id === id);
  const initialEntries = (CASE_JOURNAL_ENTRIES[id] ?? []).slice().reverse();

  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [riskLevel, setRiskLevel] = useState<Severity>("High");
  const [storyContext, setStoryContext] = useState("");
  const [notes, setNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  if (!caseItem) {
    return (
      <AppShell title="Case">
        <div className="p-6">
          <p className="text-muted-foreground">Case not found.</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  function formatEntryDate(d: Date) {
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!storyContext.trim() || !notes.trim() || !actionTaken.trim()) return;
    const newEntry: JournalEntry = {
      id: `j-${Date.now()}`,
      caseId: id,
      createdAt: formatEntryDate(new Date()),
      riskLevel,
      storyContext: storyContext.trim(),
      notes: notes.trim(),
      actionTaken: actionTaken.trim(),
    };
    setEntries((prev) => [newEntry, ...prev]);
    setStoryContext("");
    setNotes("");
    setActionTaken("");
  }

  return (
    <AppShell title={`Case · ${caseItem.fullName}`}>
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Case profile header */}
          <div className="rounded-lg border bg-background p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">{caseItem.fullName}</h1>
                <p className="text-sm text-muted-foreground">{caseItem.igHandle}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className={severityPillClass(caseItem.severity)}>
                    {caseItem.severity}
                  </Badge>
                  {caseItem.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Mood signal (indicative): {caseItem.sentimentAvg3.toFixed(1)} / 10
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Indicative only. Not diagnostic.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">Back to queue</Link>
              </Button>
            </div>
          </div>

          {/* Guided journal: add new entry */}
          <div className="rounded-lg border bg-background p-4 mb-6">
            <h2 className="font-medium mb-1">Log a flagged story</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Add an entry each time you flag a story. This helps future posts be reviewed with appropriate sensitivity based on worker-documented context.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Cues are based on patterns and context, not inferred intent.
            </p>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Review priority when flagged
                </label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as Severity)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  What did you observe in the story?
                </label>
                <Input
                  value={storyContext}
                  onChange={(e) => setStoryContext(e.target.value)}
                  placeholder="e.g. Story on high building, no caption"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Notes for this user’s profile
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Without journal context would have dismissed. Given history of suicidal tendencies, flagged and reaching out."
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Action taken
                </label>
                <Input
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="e.g. Reached out, Monitoring, Escalated"
                  className="w-full"
                />
              </div>
              <Button type="submit" disabled={!storyContext.trim() || !notes.trim() || !actionTaken.trim()}>
                Save journal entry
              </Button>
            </form>
          </div>

          {/* Journal history */}
          <div className="rounded-lg border bg-background">
            <div className="px-4 py-3 font-medium border-b">Case journal</div>
            <Separator />
            {entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No entries yet. Log a flagged story above to build this user’s profile.
              </div>
            ) : (
              <ul className="divide-y">
                {entries.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>{entry.createdAt}</span>
                      <Badge className={severityPillClass(entry.riskLevel)}>
                        {entry.riskLevel}
                      </Badge>
                      <span>· {entry.actionTaken}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{entry.storyContext}</p>
                    <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ScrollArea>
    </AppShell>
  );
}
