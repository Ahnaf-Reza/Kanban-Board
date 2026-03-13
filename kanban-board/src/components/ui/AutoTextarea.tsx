import { useEffect, useRef } from "react";
import type { AutoTextareaProps } from "../../types/ui";

export function AutoTextarea({ onSubmit, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize based on content
  useEffect(() => {
    const textarea = ref.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [props.value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.(ref.current?.value || "");
    }
    if (e.key === "Escape") {
      ref.current?.blur();
    }
  };

  return (
    <textarea
      ref={ref}
      className="w-full resize-none rounded border-0 bg-transparent p-0 focus:ring-0"
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}