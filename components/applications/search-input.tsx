// components/search-input.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { TextSearch } from "lucide-react";

export function SearchInput({ totalResults }: { totalResults: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (e.target.value) {
        params.set("q", e.target.value);
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  return (
    <InputGroup className="max-w-xs">
      <InputGroupInput
        className="focus-visible:ring-offset-0"
        placeholder="Search applications..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={handleSearch}
      />
      <InputGroupAddon>
        <TextSearch />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        {totalResults} results
      </InputGroupAddon>
    </InputGroup>
  );
}
