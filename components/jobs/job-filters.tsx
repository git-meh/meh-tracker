"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { COUNTRY_OPTIONS } from "@/lib/visa-platform/countries";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "../ui/button";
import { FunnelX } from "lucide-react";

type Props = {
  categories: string[];
};

export function JobFilters({ categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const salaryRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single source of truth: always read directly from the URL
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const sponsorship = searchParams.get("sponsorship") ?? "";
  const workMode = searchParams.get("workMode") ?? "";
  const employmentType = searchParams.get("employmentType") ?? "";
  const country = searchParams.get("country") ?? "all";
  const sourceType = searchParams.get("sourceType") ?? "";
  const minSalary = searchParams.get("minSalary") ?? "";
  const onlyMatched = searchParams.get("onlyMatched") === "true";
  const sort = searchParams.get("sort") ?? "recommended";

  // Sync text inputs from URL only when the input isn't focused (e.g. "Clear all")
  useEffect(() => {
    if (searchRef.current && document.activeElement !== searchRef.current) {
      searchRef.current.value = q;
    }
  }, [q]);

  useEffect(() => {
    if (salaryRef.current && document.activeElement !== salaryRef.current) {
      salaryRef.current.value = minSalary;
    }
  }, [minSalary]);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset to page 1 whenever any filter changes
      params.delete("page");
      startTransition(() => {
        router.push(`/jobs?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const countryIsExplicit = country && country !== "all";
  const hasFilters =
    q ||
    category ||
    sponsorship ||
    workMode ||
    employmentType ||
    countryIsExplicit ||
    sourceType ||
    minSalary ||
    onlyMatched ||
    sort !== "recommended";

  return (
    <div
      className={`space-y-3 rounded-lg border bg-background p-4 transition-opacity ${isPending ? "pointer-events-none opacity-60" : ""}`}
    >
      {/* Row 1: Keyword search + Category */}
      <div className="flex flex-wrap gap-3">
        <Input
          ref={searchRef}
          defaultValue={q}
          placeholder="Search title, company, location, tags..."
          className="min-w-50 flex-1"
          onChange={(e) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            const val = e.target.value;
            debounceRef.current = setTimeout(() => {
              push({ q: val, category: "" });
            }, 400);
          }}
        />

        {/* Category Filter */}
        <Select
          value={category || "all"}
          onValueChange={(value) => {
            const selectedCategory = value === "all" ? "" : value;

            push({
              category: selectedCategory,
              q: selectedCategory
            });
          }}
        >
          <SelectTrigger className="min-w-45">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent position="item-aligned">
            <SelectGroup>
              <SelectLabel>All job categories</SelectLabel>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) => {
            push({
              // Keep the default URL clean.
              sort: value === "recommended" ? "" : value
            });
          }}
        >
          <SelectTrigger className="min-w-40">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sort by date</SelectLabel>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Attribute filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sponsorship Type Filter */}
        <Select
          value={sponsorship || "any"}
          onValueChange={(value) => {
            push({
              sponsorship: value === "any" ? "" : value
            });
          }}
        >
          <SelectTrigger className="min-w-35 flex-1">
            <SelectValue placeholder="Select a sponsorship type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sponsorship</SelectLabel>
              <SelectItem value="any">Any sponsorship</SelectItem>
              <SelectItem value="eligible">Visa sponsor confirmed</SelectItem>
              <SelectItem value="possible">Check sponsorship</SelectItem>
              <SelectItem value="not_available">No sponsorship</SelectItem>
              <SelectItem value="unknown">Sponsorship unknown</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Work Mode Filter */}
        <Select
          value={workMode || "any"}
          onValueChange={(value) => {
            push({
              workMode: value === "any" ? "" : value
            });
          }}
        >
          <SelectTrigger className="min-w-35 flex-1">
            <SelectValue placeholder="Select a work mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Work Mode</SelectLabel>
              <SelectItem value="any">Any work mode</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">Onsite</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Employment Type Filter */}
        <Select
          value={employmentType || "any"}
          onValueChange={(value) => {
            push({
              employmentType: value === "any" ? "" : value
            });
          }}
        >
          <SelectTrigger className="min-w-35 flex-1">
            <SelectValue placeholder="Select an employment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Employment Type</SelectLabel>
              <SelectItem value="any">Any type</SelectItem>
              <SelectItem value="full_time">Full time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="part_time">Part time</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Country Filter */}
        <Select
          value={country}
          onValueChange={(value) => {
            push({
              country: value === "all" ? "" : value
            });
          }}
        >
          <SelectTrigger className="min-w-35 flex-1">
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Countries</SelectLabel>
              <SelectItem value="all">All countries</SelectItem>
              {COUNTRY_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Job Source Filter */}
        <Select
          value={sourceType || "any"}
          onValueChange={(value) => {
            push({
              sourceType: value === "any" ? "" : value
            });
          }}
        >
          <SelectTrigger className="min-w-35 flex-1">
            <SelectValue placeholder="Select a source" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Job source</SelectLabel>
              <SelectItem value="any">Any source</SelectItem>
              <SelectItem value="ats">ATS (Greenhouse / Lever)</SelectItem>
              <SelectItem value="approved_feed">
                Job board (Reed / DWP)
              </SelectItem>
              <SelectItem value="employer_site">Employer site</SelectItem>
              <SelectItem value="manual">Manually posted</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Min Salary Filter */}
        <Input
          ref={salaryRef}
          type="number"
          defaultValue={minSalary}
          placeholder="Min salary"
          className="w-32 min-w-32"
          onChange={(e) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            const val = e.target.value;
            debounceRef.current = setTimeout(
              () => push({ minSalary: val }),
              500
            );
          }}
        />

        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm select-none">
          <input
            className="accent-teal-900"
            type="checkbox"
            checked={onlyMatched}
            onChange={(e) =>
              push({ onlyMatched: e.target.checked ? "true" : "" })
            }
          />
          Matched only
        </label>

        <Button variant="link" size="sm" disabled={!hasFilters}>
          <Link href="/jobs" className="flex items-center gap-1">
            <FunnelX /> Clear filters
          </Link>
        </Button>
      </div>
    </div>
  );
}
