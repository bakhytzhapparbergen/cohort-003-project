import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

interface StarRatingProps {
  value: number; // current rating (0 = no rating)
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
  className?: string;
}

export function StarRating({ value, onChange, size = "md", className }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const starSize = size === "sm" ? "size-3.5" : "size-5";
  const interactive = !!onChange;

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      onMouseLeave={() => interactive && setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <Star
            key={star}
            className={cn(
              starSize,
              "transition-colors",
              filled ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/40",
              interactive && "cursor-pointer hover:scale-110"
            )}
            onMouseEnter={() => interactive && setHovered(star)}
            onClick={() => interactive && onChange(star)}
          />
        );
      })}
    </div>
  );
}

interface CourseRatingDisplayProps {
  average: number;
  count: number;
  size?: "sm" | "md";
  className?: string;
}

export function CourseRatingDisplay({
  average,
  count,
  size = "sm",
  className,
}: CourseRatingDisplayProps) {
  if (count === 0) return null;

  return (
    <span className={cn("flex items-center gap-1", className)}>
      <StarRating value={Math.round(average)} size={size} />
      <span className="text-xs font-medium text-amber-500">{average.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </span>
  );
}
