import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { Trash2, MessageSquare } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import type { CommentWithUser } from "~/services/commentService";

interface CommentSectionProps {
  comments: CommentWithUser[];
  currentUserId: number | null;
  isInstructor: boolean;
  isAdmin: boolean;
  canComment: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="size-8 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  isInstructor,
  isAdmin,
}: {
  comment: CommentWithUser;
  currentUserId: number | null;
  isInstructor: boolean;
  isAdmin: boolean;
}) {
  const canDelete =
    currentUserId !== null &&
    (comment.user.id === currentUserId || isInstructor || isAdmin);
  const deleteFetcher = useFetcher();

  return (
    <div className="flex gap-3">
      <Avatar name={comment.user.name} avatarUrl={comment.user.avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{comment.user.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(comment.createdAt)}
          </span>
          {isInstructor && comment.user.id !== currentUserId && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
              Student
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
      {canDelete && (
        <deleteFetcher.Form method="post">
          <input type="hidden" name="intent" value="delete-comment" />
          <input type="hidden" name="commentId" value={comment.id} />
          <button
            type="submit"
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded shrink-0"
            title="Delete comment"
            aria-label="Delete comment"
          >
            <Trash2 className="size-3.5" />
          </button>
        </deleteFetcher.Form>
      )}
    </div>
  );
}

function AddCommentForm() {
  const fetcher = useFetcher();
  const [content, setContent] = useState("");

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setContent("");
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value="add-comment" />
      <textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        rows={3}
        maxLength={2000}
        required
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <Button type="submit" size="sm" disabled={fetcher.state !== "idle"}>
        {fetcher.state !== "idle" ? "Posting..." : "Post Comment"}
      </Button>
    </fetcher.Form>
  );
}

export function CommentSection({
  comments,
  currentUserId,
  isInstructor,
  isAdmin,
  canComment,
}: CommentSectionProps) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Discussion{" "}
            {comments.length > 0 && (
              <span className="text-muted-foreground text-base font-normal">
                ({comments.length})
              </span>
            )}
          </h2>
        </div>

        {comments.length > 0 ? (
          <div className="space-y-5 mb-6">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                isInstructor={isInstructor}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-6">
            No comments yet. Be the first to start the discussion!
          </p>
        )}

        {canComment ? (
          <AddCommentForm />
        ) : (
          <p className="text-sm text-muted-foreground">
            <a href="/login" className="underline hover:text-foreground">
              Log in
            </a>{" "}
            and enroll to join the discussion.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
