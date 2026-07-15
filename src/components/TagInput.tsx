import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  transform?: (v: string) => string;
}

const TagInput = ({
  values,
  onChange,
  placeholder = "Escribe y presiona Enter",
  transform = (v) => v.trim().toUpperCase(),
}: TagInputProps) => {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const v = transform(draft);
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[2.25rem] p-2 bg-secondary/60 border border-border rounded-md">
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">
            Sin activos configurados
          </span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 bg-background border border-primary/30 text-foreground text-xs rounded-md px-2.5 py-1 font-mono"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label={`Eliminar ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className="bg-secondary border-border font-mono"
      />
    </div>
  );
};

export default TagInput;
