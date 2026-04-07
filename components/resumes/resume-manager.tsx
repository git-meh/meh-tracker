"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Trash2, Star, Upload, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Resume } from "@/lib/db/schema"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ResumeManagerProps {
  initialResumes: Resume[]
}

export function ResumeManager({ initialResumes }: ResumeManagerProps) {
  const router = useRouter()
  const [resumes, setResumes] = useState(initialResumes)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const form = new FormData()
    form.append("file", file)

    const res = await fetch("/api/resumes", { method: "POST", body: form })
    const data = await res.json().catch(() => ({ error: "Upload failed" }))

    if (!res.ok) {
      setError(data.error ?? "Upload failed")
    } else {
      setResumes((prev) => [...prev, data])
      router.refresh()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" })
    if (res.ok) {
      setResumes((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    }
  }

  async function handleSetDefault(id: string) {
    const res = await fetch(`/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })
    if (res.ok) {
      setResumes((prev) =>
        prev.map((r) => ({ ...r, isDefault: r.id === id }))
      )
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-2 text-sm font-medium">
          {uploading ? "Uploading..." : "Click to upload CV"}
        </p>
        <p className="text-xs text-muted-foreground">PDF or Word · max 5MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Resume list */}
      {resumes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No CVs uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => (
            <Card key={resume.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{resume.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(resume.fileSize)} ·{" "}
                    {formatDistanceToNow(new Date(resume.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {resume.isDefault && (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> Default
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {!resume.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(resume.id)}
                      title="Set as default"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <a
                    href={`/api/resumes/${resume.id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline px-2"
                  >
                    View
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(resume.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
