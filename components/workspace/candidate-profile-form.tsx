"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CandidateProfile } from "@/lib/db/schema"
import {
  COUNTRY_OPTIONS,
  normalizeCountryCode,
} from "@/lib/visa-platform/countries"

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

interface CandidateProfileFormProps {
  profile: CandidateProfile | null
}

export function CandidateProfileForm({
  profile,
}: CandidateProfileFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    const payload = {
      currentCountry: (formData.get("currentCountry") as string) || null,
      visaStatus: (formData.get("visaStatus") as string) || null,
      needsVisaSponsorship: formData.get("needsVisaSponsorship") === "on",
      targetCountries: formData.getAll("targetCountries"),
      preferredLocations: splitList(
        (formData.get("preferredLocations") as string) || ""
      ),
      targetRoles: splitList((formData.get("targetRoles") as string) || ""),
      yearsExperience: formData.get("yearsExperience")
        ? Number(formData.get("yearsExperience"))
        : null,
      salaryFloor: formData.get("salaryFloor")
        ? Number(formData.get("salaryFloor"))
        : null,
      preferredCurrency:
        (formData.get("preferredCurrency") as string) || "GBP",
      prefersRemote: formData.get("prefersRemote") === "on",
      summary: (formData.get("summary") as string) || null,
      skills: splitList((formData.get("skills") as string) || ""),
    }

    startTransition(async () => {
      setError(null)
      const response = await fetch("/api/candidate-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Save failed" }))
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Save failed")
        return
      }

      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="currentCountry">
            Current Country
          </label>
          <select
            id="currentCountry"
            name="currentCountry"
            defaultValue={normalizeCountryCode(profile?.currentCountry) ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select current country</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label} ({country.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="visaStatus">
            Visa Status
          </label>
          <Input
            id="visaStatus"
            name="visaStatus"
            defaultValue={profile?.visaStatus ?? ""}
            placeholder="Graduate visa / Skilled Worker / Outside UK"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="targetCountries">
            Target Countries
          </label>
          <select
            id="targetCountries"
            name="targetCountries"
            defaultValue={profile?.targetCountries ?? []}
            multiple
            className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label} ({country.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Hold Command or Ctrl to select more than one country.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="preferredLocations">
            Preferred Locations
          </label>
          <Input
            id="preferredLocations"
            name="preferredLocations"
            defaultValue={profile?.preferredLocations.join(", ") ?? ""}
            placeholder="London, Manchester, Remote"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="targetRoles">
            Target Roles
          </label>
          <Input
            id="targetRoles"
            name="targetRoles"
            defaultValue={profile?.targetRoles.join(", ") ?? ""}
            placeholder="Backend Engineer, Data Analyst"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="skills">
            Core Skills
          </label>
          <Input
            id="skills"
            name="skills"
            defaultValue={profile?.skills.join(", ") ?? ""}
            placeholder="TypeScript, SQL, Python"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="yearsExperience">
            Years of Experience
          </label>
          <Input
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            defaultValue={profile?.yearsExperience ?? ""}
            placeholder="5"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_120px]">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="salaryFloor">
              Salary Floor
            </label>
            <Input
              id="salaryFloor"
              name="salaryFloor"
              type="number"
              defaultValue={profile?.salaryFloor ?? ""}
              placeholder="45000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="preferredCurrency">
              Currency
            </label>
            <Input
              id="preferredCurrency"
              name="preferredCurrency"
              defaultValue={profile?.preferredCurrency ?? "GBP"}
              placeholder="GBP"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="needsVisaSponsorship"
            defaultChecked={profile?.needsVisaSponsorship ?? true}
          />
          I need visa sponsorship
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="prefersRemote"
            defaultChecked={profile?.prefersRemote ?? false}
          />
          Prefer remote / hybrid work
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="summary">
          Candidate Summary
        </label>
        <Textarea
          id="summary"
          name="summary"
          defaultValue={profile?.summary ?? ""}
          placeholder="Write a concise summary the AI tailoring should reuse."
          rows={6}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Candidate Profile"}
      </Button>
    </form>
  )
}
