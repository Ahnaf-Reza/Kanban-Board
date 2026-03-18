import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import type { ButtonProps } from "../../types/ui";

const buttonVariants = cva(
    // Base styles applied to ALL buttons
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
    {
      variants: {
        variant: {
          primary: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400",
          secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600",
          ghost: "text-slate-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800",
          danger: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-slate-950 dark:hover:bg-red-400",
        },
        size: {
          sm: "h-8 px-3 text-sm",
          md: "h-10 px-4",
          lg: "h-12 px-6 text-lg",
          icon: "h-10 w-10", // For icon-only buttons
        },
      },
      defaultVariants: {
        variant: "primary",
        size: "md",
      },
    },
  );

export function Button({
    className,
    variant,
    size,
    isLoading,
    children,
    disabled,
    ...props
  }: ButtonProps) {
    return (
      <button
        className={clsx(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <span className="mr-2 animate-spin">⏳</span> : null}
        {children}
      </button>
    );
  }