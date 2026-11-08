import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-primary/10 transition-opacity duration-300",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
