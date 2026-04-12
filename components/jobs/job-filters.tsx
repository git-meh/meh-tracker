"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useTransition } from "react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { COUNTRY_OPTIONS } from "@/lib/visa-platform/countries"

type Props = {
  categories: string[]
}

export function JobFilters({ categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)
  const salaryRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Single source of truth: always read directly from the URL
  const q = searchParams.get("q") ?? ""
  const category = searchParams.get("category") ?? ""
  const sponsorship = searchParams.get("sponsorship") ?? ""
  const workMode = searchParams.get("workMode") ?? ""
  const employmentType = searchParams.get("employmentType") ?? ""
  const country = searchParams.get("country") ?? "all"
  const sourceType = searchParams.get("sourceType") ?? ""
  const minSalary = searchParams.get("minSalary") ?? ""
  const onlyMatched = searchParams.get("onlyMatched") === "true"

  // Sync text inputs from URL only when the input isn't focused (e.g. "Clear all")
  useEffect(() => {
    if (searchRef.current && document.activeElement !== searchRef.current) {
      searchRef.current.value = q
    }
  }, [q])

  useEffect(() => {
    if (salaryRef.current && document.activeElement !== salaryRef.current) {
      salaryRef.current.value = minSalary
    }
  }, [minSalary])

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      // Reset to page 1 whenever any filter changes
      params.delete("page")
      startTransition(() => {
        router.push(`/jobs?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const countryIsExplicit = country && country !== "all"
  const hasFilters =
    q || category || sponsorship || workMode || employmentType || countryIsExplicit || sourceType || minSalary || onlyMatched

  return (
    <div className={`space-y-3 rounded-lg border bg-background p-4 transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Row 1: Keyword search + Category */}
      <div className="flex flex-wrap gap-3">
        <Input
          ref={searchRef}
          defaultValue={q}
          placeholder="Search title, company, location, tags..."
          className="min-w-[200px] flex-1"
          onChange={(e) => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            const val = e.target.value
            debounceRef.current = setTimeout(() => {
              push({ q: val, category: "" })
            }, 400)
          }}
        />

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
          value={category}
          onChange={(e) => {
            const cat = e.target.value
            // Category replaces the keyword search
            push({ category: cat, q: cat })
          }}
        >
          <option value="">All job categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: Attribute filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sponsorship}
          onChange={(e) => push({ sponsorship: e.target.value })}
        >
          <option value="">Any sponsorship</option>
          <option value="eligible">Visa sponsor confirmed</option>
          <option value="possible">Check sponsorship</option>
          <option value="not_available">No sponsorship</option>
          <option value="unknown">Sponsorship unknown</option>
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={workMode}
          onChange={(e) => push({ workMode: e.target.value })}
        >
          <option value="">Any work mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={employmentType}
          onChange={(e) => push({ employmentType: e.target.value })}
        >
          <option value="">Any type</option>
          <option value="full_time">Full time</option>
          <option value="contract">Contract</option>
          <option value="part_time">Part time</option>
          <option value="internship">Internship</option>
          <option value="temporary">Temporary</option>
          <option value="apprenticeship">Apprenticeship</option>
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={country}
          onChange={(e) => push({ country: e.target.value })}
        >
          <option value="all">All countries</option>
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sourceType}
          onChange={(e) => push({ sourceType: e.target.value })}
        >
          <option value="">Any source</option>
          <option value="ats">ATS (Greenhouse / Lever)</option>
          <option value="approved_feed">Job board (Reed / DWP)</option>
          <option value="employer_site">Employer site</option>
          <option value="manual">Manually posted</option>
        </select>

        <Input
          ref={salaryRef}
          type="number"
          defaultValue={minSalary}
          placeholder="Min salary"
          className="w-36"
          onChange={(e) => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            const val = e.target.value
            debounceRef.current = setTimeout(() => push({ minSalary: val }), 500)
          }}
        />

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm select-none">
          <input
            type="checkbox"
            checked={onlyMatched}
            onChange={(e) => push({ onlyMatched: e.target.checked ? "true" : "" })}
          />
          Matched only
        </label>

        {hasFilters && (
          <Link
            href="/jobs"
            className="flex h-10 items-center px-3 text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </Link>
        )}
      </div>
    </div>
  )
}
