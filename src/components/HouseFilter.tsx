import type { HouseFilter as HouseFilterType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: HouseFilterType;
  onChange: (v: HouseFilterType) => void;
}

const filters: { value: HouseFilterType; label: string }[] = [
  { value: "all", label: "Оба дома" },
  { value: "green", label: "GREEN" },
  { value: "black", label: "BLACK" },
];

export default function HouseFilter({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 rounded-xl bg-secondary p-1">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
            value === f.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {f.value === "green" && (
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-house-green" />
          )}
          {f.value === "black" && (
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-house-black" />
          )}
          {f.label}
        </button>
      ))}
    </div>
  );
}
