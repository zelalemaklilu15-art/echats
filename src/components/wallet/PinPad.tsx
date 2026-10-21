import { Delete } from "lucide-react";

interface Props { value: string; onChange: (v: string) => void; length: number; disabled?: boolean; }

/** Shared numeric keypad + dots used by every wallet PIN sheet. */
export default function PinPad({ value, onChange, length, disabled }: Props) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === "del") onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + k);
  };
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-4" aria-label="PIN">
        {Array.from({ length }).map((_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors ${i < value.length ? "bg-primary" : "bg-foreground/20"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) =>
          k === "" ? <span key={i} /> : (
            <button key={i} type="button" disabled={disabled} onClick={() => press(k)}
              aria-label={k === "del" ? "Delete" : k}
              className="h-14 rounded-2xl bg-foreground/5 border border-foreground/10 text-2xl font-light text-foreground active:bg-foreground/10 flex items-center justify-center disabled:opacity-50">
              {k === "del" ? <Delete className="h-5 w-5 text-muted-foreground" /> : k}
            </button>
          ))}
      </div>
    </div>
  );
}
