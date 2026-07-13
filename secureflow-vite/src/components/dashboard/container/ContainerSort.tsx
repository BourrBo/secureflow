import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function ContainerSort({
  value,
  onChange,
}: Props) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Sort By" />
      </SelectTrigger>

      <SelectContent>

        <SelectItem value="severity">
          Severity
        </SelectItem>

        <SelectItem value="cvss">
          CVSS Score
        </SelectItem>

        <SelectItem value="package">
          Package Name
        </SelectItem>

      </SelectContent>

    </Select>
  );
}