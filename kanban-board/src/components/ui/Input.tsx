import { forwardRef, useId } from "react";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import type { InputProps } from "../../types/ui";

const inputVariants = cva(
  "w-full rounded-md border bg-white text-slate-900 shadow-sm transition-colors outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      intent: {
        default: "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25",
        error: "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/25",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-3",
        lg: "h-11 px-4 text-base",
      },
    },
    defaultVariants: {
      intent: "default",
      size: "md",
    },
  },
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    errorMessage,
    className,
    wrapperClassName,
    intent,
    size,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasError = Boolean(errorMessage);

  return (
    <div className={clsx("w-full", wrapperClassName)}>
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <input
        ref={ref}
        id={inputId}
        className={clsx(inputVariants({ intent: hasError ? "error" : intent, size }), className)}
        aria-invalid={hasError}
        aria-describedby={hint || errorMessage ? `${inputId}-message` : undefined}
        {...props}
      />

      {errorMessage ? (
        <p id={`${inputId}-message`} className="mt-1.5 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
      {!errorMessage && hint ? (
        <p id={`${inputId}-message`} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
