import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ContainerSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ContainerSearch({
  value,
  onChange,
}: ContainerSearchProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={value}
          placeholder="Search package, CVE, ecosystem..."
          onChange={(e) => onChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {value && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange("")}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}