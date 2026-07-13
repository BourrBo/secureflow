import { Button } from "@/components/ui/button";
import type { PaginationProps } from "./types";

export function ContainerPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
}: PaginationProps) {
  const start =
    totalItems === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const end = Math.min(
    currentPage * pageSize,
    totalItems
  );

  return (
    <div className="mt-5 flex items-center justify-between">

      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalItems} vulnerabilities
      </p>

      <div className="flex gap-2">

        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={currentPage === 1}
        >
          Previous
        </Button>

        <Button
          variant="outline"
          onClick={onNext}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>

      </div>

    </div>
  );
}