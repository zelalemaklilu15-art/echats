import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { COUNTRIES, type Country } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface Props {
  country: Country;
  onCountryChange: (c: Country) => void;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/** International phone field: flag + dial-code picker with search, and the local number. */
export function PhoneInput({ country, onCountryChange, value, onChange, placeholder = "Phone number", className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^\+/, "");
    if (!s) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(s) || c.dial.slice(1).startsWith(s) || c.iso.toLowerCase() === s);
  }, [q]);

  return (
    <div className={cn("flex items-center gap-2", className)} translate="no">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Country: ${country.name} ${country.dial}`}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <span className="text-lg leading-none">{country.flag}</span>
            <span>{country.dial}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search country or code"
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1" role="listbox">
            {list.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">No country found</p>}
            {list.map((c) => (
              <button
                key={c.iso}
                type="button"
                role="option"
                aria-selected={c.iso === country.iso}
                onClick={() => { onCountryChange(c); setOpen(false); setQ(""); }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-foreground hover:bg-muted",
                  c.iso === country.iso && "bg-muted",
                )}
              >
                <span className="text-lg leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground">{c.dial}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
    </div>
  );
}
