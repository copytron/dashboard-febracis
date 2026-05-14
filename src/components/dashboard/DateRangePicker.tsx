import { useState, useMemo } from "react";
import { format, subDays, startOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Preset = { label: string; from: Date; to: Date };

function getPresets(): Preset[] {
  const today = startOfDay(new Date());
  return [
    { label: "Hoje", from: today, to: today },
    { label: "Ontem", from: subDays(today, 1), to: subDays(today, 1) },
    { label: "Últimos 7 dias", from: subDays(today, 6), to: today },
    { label: "Últimos 30 dias", from: subDays(today, 29), to: today },
    { label: "Este mês", from: startOfMonth(today), to: today },
    { label: "Mês passado", from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) },
  ];
}

function toYMD(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fromYMD(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string | null;
  dateTo: string | null;
  onChange: (from: string | null, to: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const presets = useMemo(getPresets, []);

  const range: DateRange | undefined = useMemo(() => {
    const from = fromYMD(dateFrom);
    const to = fromYMD(dateTo);
    if (!from && !to) return undefined;
    return { from, to };
  }, [dateFrom, dateTo]);

  const displayLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "Período";
    const f = dateFrom ? format(fromYMD(dateFrom)!, "dd/MM/yy", { locale: ptBR }) : "...";
    const t = dateTo ? format(fromYMD(dateTo)!, "dd/MM/yy", { locale: ptBR }) : "...";
    return `${f} — ${t}`;
  }, [dateFrom, dateTo]);

  function handlePreset(p: Preset) {
    onChange(toYMD(p.from), toYMD(p.to));
    setOpen(false);
  }

  function handleRangeSelect(r: DateRange | undefined) {
    if (!r) {
      onChange(null, null);
      return;
    }
    onChange(r.from ? toYMD(r.from) : null, r.to ? toYMD(r.to) : null);
    if (r.from && r.to) {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 justify-start gap-2 min-w-[180px] bg-card text-xs font-normal",
            !dateFrom && !dateTo && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-3.5 opacity-60" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex" align="start" sideOffset={8}>
        {/* Presets */}
        <div className="border-r border-border p-2 flex flex-col gap-0.5 min-w-[140px]">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              className="text-left px-3 py-1.5 rounded text-xs hover:bg-accent transition"
            >
              {p.label}
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => { onChange(null, null); setOpen(false); }}
                className="text-left px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent transition"
              >
                Limpar
              </button>
            </>
          )}
        </div>
        {/* Calendar */}
        <div className="p-2">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            locale={ptBR}
            defaultMonth={fromYMD(dateFrom) ?? subMonths(new Date(), 1)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
