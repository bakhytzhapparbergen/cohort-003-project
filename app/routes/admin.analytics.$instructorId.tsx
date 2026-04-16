import React, { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.analytics.$instructorId";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import {
  getInstructorSummary,
  getRevenueTimeSeries,
  getCourseBreakdown,
  type Period,
} from "~/services/analyticsService";
import { UserRole } from "~/db/schema";
import { cn } from "~/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, DollarSign, Star, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function parsePeriod(raw: string | null): Period {
  if (raw === "7d" || raw === "30d" || raw === "12m" || raw === "all") return raw;
  return "30d";
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const name = loaderData?.instructorName ?? "Instructor";
  return [
    { title: `${name} — Analytics — Cadence` },
    { name: "description", content: `Analytics for ${name}` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const instructorId = Number(params.instructorId);
  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    throw data("Invalid instructor ID.", { status: 400 });
  }

  const instructor = getUserById(instructorId);
  if (!instructor) {
    throw data("Instructor not found.", { status: 404 });
  }
  if (instructor.role !== UserRole.Instructor) {
    throw data("This user is not an instructor.", { status: 400 });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));

  const summary = getInstructorSummary({ instructorId, period });
  const revenueTimeSeries = getRevenueTimeSeries({ instructorId, period });
  const courseBreakdown = getCourseBreakdown({ instructorId, period });

  return {
    summary,
    revenueTimeSeries,
    courseBreakdown,
    period,
    instructorName: instructor.name,
    instructorId,
  };
}

// ─── PeriodSelector ───────────────────────────────────────────────────────────

function PeriodSelector({ currentPeriod }: { currentPeriod: Period }) {
  const [, setSearchParams] = useSearchParams();
  const [activePeriod, setActivePeriod] = useState(currentPeriod);

  const options: { value: Period; label: string }[] = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "12m", label: "12 months" },
    { value: "all", label: "All time" },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-muted p-1">
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => { setActivePeriod(value); setSearchParams({ period: value }); }}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            activePeriod === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatRating(avg: number, count: number): string {
  if (count === 0) return "No ratings";
  return `${avg.toFixed(1)} / 5`;
}

// ─── RevenueLineChart ─────────────────────────────────────────────────────────

function formatXAxisTick(date: string): string {
  if (date.length === 7) {
    const [year, month] = date.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const [year, month, day] = date.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RevenueLineChart({ data: chartData }: { data: Array<{ date: string; revenue: number }> }) {
  const hasData = chartData.some((d) => d.revenue > 0);
  if (!hasData) return null;

  const tickCount = chartData.length;
  const tickInterval = tickCount <= 12 ? 0 : Math.floor(tickCount / 12);

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-base font-semibold">Revenue Over Time</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tickFormatter={formatXAxisTick} interval={tickInterval} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => `$${(v / 100).toLocaleString()}`} tick={{ fontSize: 12 }} width={64} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => {
              const cents = typeof value === "number" ? value : 0;
              return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) =>
              typeof label === "string" ? formatXAxisTick(label) : String(label ?? "")
            }
          />
          <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} className="stroke-primary" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── CourseAnalyticsTable ─────────────────────────────────────────────────────

type CourseRow = {
  courseId: number;
  title: string;
  revenue: number;
  enrollments: number;
  avgRating: number;
  ratingCount: number;
  completionRate: number;
};

type SortKey = keyof Omit<CourseRow, "courseId" | "title">;

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "enrollments", label: "Enrollments" },
  { key: "avgRating", label: "Avg Rating" },
  { key: "ratingCount", label: "Reviews" },
  { key: "completionRate", label: "Completion" },
];

function SortHeader({
  label, sortKey, currentKey, direction, onSort,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; direction: "asc" | "desc"; onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
    >
      {label}
      {active ? (
        direction === "desc" ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />
      ) : (
        <ChevronDown className="size-3.5 opacity-30" />
      )}
    </button>
  );
}

function CourseAnalyticsTable({ rows }: { rows: CourseRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  if (rows.length === 0) return null;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return direction === "desc" ? -diff : diff;
  });

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Course</th>
              {SORT_KEYS.map(({ key, label }) => (
                <th key={key} className="px-4 py-3 text-right">
                  <div className="flex justify-end">
                    <SortHeader label={label} sortKey={key} currentKey={sortKey} direction={direction} onSort={handleSort} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.courseId} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{row.title}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRevenue(row.revenue)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.enrollments.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.ratingCount > 0 ? row.avgRating.toFixed(1) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.ratingCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.enrollments > 0 ? `${Math.round(row.completionRate * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── HydrateFallback ──────────────────────────────────────────────────────────

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-9 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-64 w-full" />
      </Card>
      <Card>
        <div className="p-4">
          <Skeleton className="mb-3 h-5 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Route Component ──────────────────────────────────────────────────────────

export default function AdminInstructorAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, revenueTimeSeries, courseBreakdown, period, instructorName, instructorId } = loaderData;
  const hasActivity = summary.totalRevenue > 0 || summary.totalEnrollments > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/admin/users" className="hover:text-foreground">Manage Users</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">{instructorName}</p>
        </div>
        <PeriodSelector key="period-selector" currentPeriod={period} />
      </div>

      {/* Summary Cards */}
      {hasActivity ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            value={formatRevenue(summary.totalRevenue)}
            label="Total Revenue"
            icon={<DollarSign className="size-4" />}
          />
          <SummaryCard
            value={summary.totalEnrollments.toLocaleString()}
            label="Total Enrollments"
            icon={<Users className="size-4" />}
          />
          <SummaryCard
            value={formatRating(summary.avgRating, summary.ratingCount)}
            label={`Average Rating (${summary.ratingCount.toLocaleString()} ${summary.ratingCount === 1 ? "review" : "reviews"})`}
            icon={<Star className="size-4" />}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border py-16 text-center">
          <BarChart3 className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No activity yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No enrollments or purchases in the selected period.
          </p>
        </div>
      )}

      {/* Revenue Chart */}
      <RevenueLineChart data={revenueTimeSeries} />

      {/* Course Breakdown Table */}
      {courseBreakdown.length > 0 ? (
        <CourseAnalyticsTable rows={courseBreakdown} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border py-12 text-center">
          <BarChart3 className="mb-4 size-10 text-muted-foreground/40" />
          <h2 className="text-base font-medium">No courses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This instructor hasn't created any courses.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to access this page.";
    } else if (error.status === 404) {
      title = "Instructor not found";
      message = typeof error.data === "string" ? error.data : "This instructor does not exist.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/admin/users">
            <Button variant="outline">Manage Users</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
