import { clsx } from "clsx";
import type { CardProps } from "../../types/ui";

  export function Card({ children, className, isDragging, isOver }: CardProps) {
    return (
      <div
        className={clsx(
          "rounded-lg border bg-white p-4 shadow-sm transition-all",
          isDragging && "rotate-3 scale-105 shadow-xl opacity-90",
          isOver && "ring-2 ring-blue-500",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  