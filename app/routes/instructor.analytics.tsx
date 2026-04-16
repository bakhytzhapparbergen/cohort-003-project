import { Link, useSearchParams } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { getInstructorSummary, type Period } from "~/services/analyticsService";
import { UserRole } from "~/db/schema";
import { Card, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, BarChart3 } from "lucide-react";

const VALID_PERIODS = ["7d", "30d", "12m"] as const;

function parsePeriod(raw: string | null): Period {
  if (raw === "7d" || raw === "30d" || raw === "12m") return raw;
  return "30d";
}

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "View your course analytics" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));

  const summary = getInstructorSummary({ instructorId: currentUserId, period });

  return { summary, period };
}

// ─── PeriodSelector ───────────────────────────────────────────────────────────

function PeriodSelector({ currentPeriod }: { currentPeriod: Period }) {
  const [, setSearchParams] = useSearchParams();

  const options: { value: Period; label: string }[] = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "12m", label: "12 months" },
  ];

  return (
    <div className="flex gap-2">
      {options.map(({ value, label }) => (
        <Button
          key={value}
          variant={currentPeriod === value ? "default" : "outline"}
          size="sm"
          onClick={() => setSearchParams({ period: value })}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
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

// ─── HydrateFallback ──────────────────────────────────────────────────────────

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-5 w-56" />
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
    </div>
  );
}

// ─── Route Component ──────────────────────────────────────────────────────────

export default function InstructorAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, period } = loaderData;
  const hasActivity = summary.totalRevenue > 0 || summary.totalEnrollments > 0;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Track your course revenue, enrollments, and ratings
          </p>
        </div>
        <PeriodSelector currentPeriod={period} />
      </div>

      {/* Summary Cards */}
      {hasActivity ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            value={formatRevenue(summary.totalRevenue)}
            label="Total Revenue"
          />
          <SummaryCard
            value={summary.totalEnrollments.toLocaleString()}
            label="Total Enrollments"
          />
          <SummaryCard
            value={formatRating(summary.avgRating, summary.ratingCount)}
            label={`Average Rating (${summary.ratingCount.toLocaleString()} ${summary.ratingCount === 1 ? "review" : "reviews"})`}
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
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to access this page.";
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
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
