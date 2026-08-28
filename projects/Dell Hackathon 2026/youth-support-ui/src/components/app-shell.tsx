"use client";

import Link from "next/link";
import { ReactNode, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, MessageSquare, Bell, Settings } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { CASES, CaseItem } from "@/lib/mock-data";

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type NavItem = { label: string; href: string; count?: number };

const railClass =
  "w-16 border-r border-white/10 bg-[#3F0E40] text-white flex flex-col items-center py-4 gap-3";

const sidebarClass =
  "w-80 border-r border-white/10 bg-[#350D36] text-white/90 flex flex-col";

const views: NavItem[] = [
  { label: "Assigned to me", href: "/dashboard", count: 3 },
  { label: "High priority", href: "/dashboard?view=high", count: 1 },
  { label: "Monitoring", href: "/dashboard?view=monitoring" },
  { label: "Recently updated", href: "/dashboard?view=recent" },
];

function RailButton({ children }: { children: ReactNode }) {
  return (
    <button className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition">
      {children}
    </button>
  );
}

function UnreadPill({ count }: { count: number }) {
  return (
    <span className="text-[11px] bg-white/15 px-2 py-0.5 rounded-full text-white/90">
      {count}
    </span>
  );
}

// Color rule for points
function sentimentColor(score: number) {
  if (score <= 3) return "#ef4444"; // red-500
  if (score <= 7) return "#f97316"; // orange-500
  return "#22c55e"; // green-500
}

// Custom dot renderer so each point can be colored
function SentimentDot(props: any) {
  const { cx, cy, payload } = props;
  const score = payload?.score ?? 0;
  const fill = sentimentColor(score);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="white"
      strokeWidth={2}
    />
  );
}

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");

  // modal state
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<CaseItem | null>(null);

  // chart data for selected case
  const chartData = useMemo(() => {
    if (!selected) return [];
    return selected.sentimentLast5.map((score, idx) => ({
      post: `P${idx + 1}`,
      score,
    }));
  }, [selected]);

  return (
    <div className="h-screen w-screen flex bg-[#F8F8FA]">
      {/* Left icon rail */}
      <div className={railClass}>
        <RailButton>
          <Home size={18} />
        </RailButton>
        <RailButton>
          <MessageSquare size={18} />
        </RailButton>
        <RailButton>
          <Bell size={18} />
        </RailButton>

        <div className="flex-1" />

        <RailButton>
          <Settings size={18} />
        </RailButton>
      </div>

      {/* Sidebar */}
      <div className={sidebarClass}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">Support Workspace</div>
            <Button variant="secondary" size="sm">
              New
            </Button>
          </div>
          <div className="text-xs text-white/60 mt-1">Consent-based decision support</div>
        </div>

        <Separator className="bg-white/10" />

        <ScrollArea className="flex-1">
          <div className="px-3 py-3">
            <div className="text-xs font-medium text-white/50 mb-2">VIEWS</div>

            <div className="space-y-1">
              {views.map((item) => {
                const isActive =
                  pathname === "/dashboard" &&
                  ((item.href === "/dashboard" && !viewParam) ||
                    (item.href.includes("view=") &&
                      viewParam === item.href.split("view=")[1]));

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={[
                      "flex items-center justify-between rounded-md px-3 py-1.5 transition",
                      isActive ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/85",
                    ].join(" ")}
                  >
                    <span className="text-sm">{item.label}</span>
                    {item.count ? <UnreadPill count={item.count} /> : null}
                  </Link>
                );
              })}
            </div>

            <div className="text-xs font-medium text-white/50 mt-6 mb-2">CASES</div>

            {/* IMPORTANT: These are now buttons (open modal) instead of Links */}
            <div className="space-y-1">
              {CASES.map((c) => {
                const unread = c.unread ?? 0;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setIsOpen(true);
                    }}
                    className="w-full text-left flex items-center justify-between rounded-md px-3 py-1.5 transition hover:bg-white/10 text-white/85"
                  >
                    <div className="min-w-0">
                      <div className="text-sm truncate">{c.fullName}</div>
                      <div className="text-xs text-white/60 truncate">{c.igHandle}</div>
                    </div>

                    {unread > 0 ? <UnreadPill count={unread} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <Separator className="bg-white/10" />

        <div className="px-4 py-3 text-sm">
          <div className="font-medium text-white">Worker</div>
          <div className="text-xs text-white/60">Online</div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 border-b bg-white/80 backdrop-blur flex items-center gap-3 px-4">
          <div className="font-semibold">{title}</div>
          <div className="flex-1" />
          <div className="w-[420px] max-w-[50vw]">
            <Input placeholder="Search cases…" />
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>

      {/* Popup modal with chart */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {selected ? `${selected.fullName} — Mood signal trend` : "Mood signal trend"}
            </DialogTitle>
            <DialogDescription>
              Last 5 posts — mood signal (indicative). Indicative only. Not diagnostic. A lens, not a label.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                IG: <span className="font-medium text-foreground">{selected.igHandle}</span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="post" />
                    <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#111827"
                      strokeWidth={2}
                      dot={<SentimentDot />}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Color rule: ≤3 (red), ≤7 (orange), &gt;7 (green). Indicative only. Not diagnostic.
                </div>

                {/* Optional: keep navigation available */}
                <Button asChild variant="secondary">
                  <Link href={`/cases/${selected.id}`}>Go to case</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
