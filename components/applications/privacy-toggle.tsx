"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface PrivacyToggleProps {
  applicationId: string
  isPrivate: boolean
}

export function PrivacyToggle({ applicationId, isPrivate }: PrivacyToggleProps) {
  const router = useRouter()
  const [checked, setChecked] = useState(isPrivate)

  async function handleToggle(val: boolean) {
    setChecked(val)
    await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrivate: val }),
    })
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <Switch id="privacy" checked={checked} onCheckedChange={handleToggle} />
      <Label htmlFor="privacy" className="text-sm cursor-pointer">
        {checked ? "Private (only you can see this)" : "Visible to group"}
      </Label>
    </div>
  )
}
