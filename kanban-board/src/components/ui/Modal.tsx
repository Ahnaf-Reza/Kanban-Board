import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import type { ModalProps } from "../../types/ui";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement;
    dialogRef.current?.focus();

    return () => {
      if (previousActive instanceof HTMLElement) {
        previousActive.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : "Dialog"}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        ref={dialogRef}
        className={clsx(
          "relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl",
          className,
        )}
      >
        {title ? (
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id={descriptionId} className="mt-1 text-sm text-slate-600">
            {description}
          </p>
        ) : null}

        <div className="mt-4">{children}</div>

        {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
