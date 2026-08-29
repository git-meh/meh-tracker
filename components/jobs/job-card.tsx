import Link from "next/link";
import { MapPin, DollarSign, ExternalLink, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvailabilityBadge } from "./availability-badge";
import { QuickApplyButton } from "./quick-apply-button";
import { formatDistanceToNow } from "date-fns";
import type {
  ApplicationStatus,
  Availability,
  JobSourceType,
  VisaSponsorshipStatus,
  WorkMode
} from "@/lib/db/schema";
import {
  JOB_SOURCE_TYPE_LABELS,
  VISA_SPONSORSHIP_LABELS,
  WORK_MODE_LABELS
} from "@/lib/visa-platform/constants";

interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string;
    url: string;
    description: string | null;
    salaryRange: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string;
    location: string | null;
    tags: string[];
    availability: Availability;
    createdAt: Date;
    sourceType: JobSourceType;
    visaSponsorshipStatus: VisaSponsorshipStatus;
    workMode: WorkMode;
    applicantCount?: number;
    posterName?: string | null;
    sourceName?: string | null;
  };
  userApplication?: { id: string; status: ApplicationStatus } | null;
  isAuthenticated?: boolean;
  matchScore?: number | null;
}

export function JobCard({
  job,
  userApplication,
  isAuthenticated,
  matchScore
}: JobCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/jobs/${job.id}`}
              className="line-clamp-1 font-heading text-base font-semibold hover:underline"
            >
              {job.title}
            </Link>
            <p className="text-sm font-medium text-muted-foreground">
              {job.company}
            </p>
          </div>
          <AvailabilityBadge availability={job.availability} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          {job.salaryRange && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {job.salaryRange}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
          </span>
        </div>

        {job.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {job.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mb-2 flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {VISA_SPONSORSHIP_LABELS[job.visaSponsorshipStatus]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {WORK_MODE_LABELS[job.workMode]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {JOB_SOURCE_TYPE_LABELS[job.sourceType]}
          </Badge>
          {typeof matchScore === "number" ? (
            <Badge
              variant={
                matchScore >= 75
                  ? "success"
                  : matchScore >= 50
                    ? "warning"
                    : "secondary"
              }
              className="shrink-0 text-xs whitespace-nowrap"
            >
              Match {matchScore}
            </Badge>
          ) : null}
        </div>

        {(typeof job.applicantCount === "number" && job.applicantCount > 0) ||
        job.sourceName ||
        job.posterName ? (
          <div className="mb-2 flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
            {typeof job.applicantCount === "number" &&
              job.applicantCount > 0 && (
                <span>{job.applicantCount} applied from group</span>
              )}
            {job.sourceName ? (
              <span className="truncate">source {job.sourceName}</span>
            ) : job.posterName ? (
              <span className="truncate">by {job.posterName}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {isAuthenticated && (
            <QuickApplyButton
              jobId={job.id}
              existingApplicationId={userApplication?.id}
              existingStatus={userApplication?.status}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5 text-xs"
            asChild
          >
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
