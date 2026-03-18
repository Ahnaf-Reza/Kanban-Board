import { clsx } from "clsx";
import type { CardProps } from "../../types/ui";

  export function Card({ children, className, isDragging, isOver }: CardProps) {
    return (
      <div
        className={clsx(
          "rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-sm transition-all dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          isDragging && "rotate-3 scale-105 shadow-xl opacity-90",
          isOver && "ring-2 ring-blue-500",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  