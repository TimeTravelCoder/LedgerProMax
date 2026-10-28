import { useEffect, useRef } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmDialog({ options, onResolve }: { options: ConfirmOptions; onResolve: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={ref} className="app-confirm" aria-labelledby="confirm-title" aria-describedby="confirm-description"
      onCancel={event => { event.preventDefault(); onResolve(false); }}>
      <h3 id="confirm-title">{options.title}</h3>
      <p id="confirm-description">{options.message}</p>
      <div className="about-actions">
        <button autoFocus className="btn" onClick={() => onResolve(false)}>{options.cancelLabel || "取消"}</button>
        <button className="btn btn-primary" onClick={() => onResolve(true)}>{options.confirmLabel || "确定"}</button>
      </div>
    </dialog>
  );
}
