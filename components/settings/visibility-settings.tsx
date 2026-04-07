"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

interface VisibilitySettingsProps {
  currentVisibility: "public" | "private"
}

export function VisibilitySettings({ currentVisibility }: VisibilitySettingsProps) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(currentVisibility === "public")

  async function handleToggle(val: boolean) {
    setIsPublic(val)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from("profiles")
      .update({ visibility: val ? "public" : "private" })
      .eq("id", user.id)

    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <Switch id="visibility" checked={isPublic} onCheckedChange={handleToggle} />
      <Label htmlFor="visibility" className="cursor-pointer">
        {isPublic
          ? "Your applications are visible to the group by default"
          : "Your applications are private by default"}
      </Label>
    </div>
  )
}
