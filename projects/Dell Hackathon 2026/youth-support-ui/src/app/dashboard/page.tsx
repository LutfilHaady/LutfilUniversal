import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { CASES, Severity } from "@/lib/mock-data";

// maps severity to Tailwind classes for color
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

export default function DashboardPage() {
  const queue = CASES;

  return (
    <AppShell title="Dashboard">
      <div className="h-full flex flex-col min-h-0">
        <ScrollArea className="flex-1 min-h-0">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="text-sm text-muted-foreground mb-3">
              Priority queue (mock) • Human review required
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Cues are based on patterns and context, not inferred intent.
            </p>

            <div className="rounded-lg border bg-background">
              {/* Header */}
              <div className="px-4 py-3 font-medium">Cases needing attention</div>
              <Separator />

              {/* Table header row */}
              <div className="px-4 py-2 text-xs text-muted-foreground grid grid-cols-[260px_120px_1fr_140px_80px_76px] gap-3">
                <div>Person</div>
                <div>Review priority</div>
                <div>Signals</div>
                <div>Mood signal (indicative)</div>
                <div className="text-right">Updated</div>
                <div />
              </div>
              <Separator />

              {/* Rows */}
              <div className="divide-y">
                {queue.map((c) => (
                  <div
                    key={c.id}
                    className="px-4 py-3 grid grid-cols-[260px_120px_1fr_140px_80px_76px] gap-3 items-center"
                  >
                    {/* Column 1: Name + IG handle */}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.igHandle}
                      </div>
                    </div>

                    {/* Column 2: Severity pill (color-coded) */}
                    <div>
                      <Badge className={severityPillClass(c.severity)}>{c.severity}</Badge>
                    </div>

                    {/* Column 3: Tags / signals */}
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="outline" className="truncate">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    {/* Column 4: Mood signal (indicative) */}
                    <div className="text-sm">
                      <span className="font-medium">{c.sentimentAvg3.toFixed(1)}</span>
                      <span className="text-muted-foreground"> / 10</span>
                    </div>

                    {/* Column 5: Updated */}
                    <div className="text-sm text-muted-foreground text-right">{c.updated}</div>

                    {/* Column 6: Open button */}
                    <div className="flex justify-end">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/cases/${c.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Bottom composer */}
        <div className="border-t bg-background px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <input
              className="flex-1 h-10 rounded-lg border px-3 text-sm bg-background"
              placeholder="Log a quick note…"
            />
            <Button>Save</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
