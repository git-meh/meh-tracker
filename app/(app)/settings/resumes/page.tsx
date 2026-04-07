import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { resumes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { ResumeManager } from "@/components/resumes/resume-manager"

export default async function ResumesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const userResumes = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My CVs</h1>
        <p className="text-sm text-muted-foreground">
          Upload and manage the CVs you use for applications. PDF and Word documents, max 5MB.
        </p>
      </div>
      <ResumeManager initialResumes={userResumes} />
    </div>
  )
}
