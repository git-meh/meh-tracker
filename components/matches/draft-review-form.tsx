"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type DraftArtifactState = {
  tailored_resume: string
  cover_letter: string
  application_answers: string
}

interface DraftReviewFormProps {
  draftId: string
  initialReviewNotes: string | null
  initialArtifacts: DraftArtifactState
}

export function DraftReviewForm({
  draftId,
  initialReviewNotes,
  initialArtifacts,
}: DraftReviewFormProps) {
  const router = useRouter()
  const [reviewNotes, setReviewNotes] = useState(initialReviewNotes ?? "")
  const [artifacts, setArtifacts] = useState<DraftArtifactState>(initialArtifacts)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function saveEdits() {
    const response = await fetch(`/api/application-drafts/${draftId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewNotes: reviewNotes || null,
        artifacts: [
          {
            type: "tailored_resume",
            title: "Tailored Resume",
            content: artifacts.tailored_resume,
          },
          {
            type: "cover_letter",
            title: "Cover Letter",
            content: artifacts.cover_letter,
          },
          {
            type: "application_answers",
            title: "Application Answers",
            content: artifacts.application_answers,
          },
        ],
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Draft save failed" }))
      throw new Error(data.error ?? "Draft save failed")
    }
  }

  function updateDraft(status: "approved" | "rejected") {
    startTransition(async () => {
      setMessage(null)

      try {
        await saveEdits()
        const response = await fetch(`/api/application-drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            reviewNotes: reviewNotes || null,
          }),
        })

        const data = await response.json().catch(() => ({ error: "Draft update failed" }))
        if (!response.ok) {
          throw new Error(data.error ?? "Draft update failed")
        }

        if (status === "approved" && data.applicationId) {
          router.push(`/applications/${data.applicationId}`)
          return
        }

        setMessage(status === "approved" ? "Draft approved." : "Draft rejected.")
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Draft update failed")
      }
    })
  }

  function saveOnly() {
    startTransition(async () => {
      setMessage(null)
      try {
        await saveEdits()
        setMessage("Draft changes saved.")
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Draft save failed")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="reviewNotes">
          Review Notes
        </label>
        <Textarea
          id="reviewNotes"
          value={reviewNotes}
          onChange={(event) => setReviewNotes(event.target.value)}
          placeholder="Add recruiter-facing or personal notes before approval."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="tailoredResume">
          Tailored Resume
        </label>
        <Textarea
          id="tailoredResume"
          value={artifacts.tailored_resume}
          onChange={(event) =>
            setArtifacts((current) => ({
              ...current,
              tailored_resume: event.target.value,
            }))
          }
          rows={16}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="coverLetter">
          Cover Letter
        </label>
        <Textarea
          id="coverLetter"
          value={artifacts.cover_letter}
          onChange={(event) =>
            setArtifacts((current) => ({
              ...current,
              cover_letter: event.target.value,
            }))
          }
          rows={14}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="applicationAnswers">
          Application Answers
        </label>
        <Textarea
          id="applicationAnswers"
          value={artifacts.application_answers}
          onChange={(event) =>
            setArtifacts((current) => ({
              ...current,
              application_answers: event.target.value,
            }))
          }
          rows={12}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={isPending} onClick={saveOnly}>
          {isPending ? "Working..." : "Save Changes"}
        </Button>
        <Button type="button" disabled={isPending} onClick={() => updateDraft("approved")}>
          {isPending ? "Working..." : "Approve & Continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => updateDraft("rejected")}
        >
          Reject Draft
        </Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  )
}
