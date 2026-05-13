/**
 * Project Details Page.
 * This client-side component provides a high-level overview of a project,
 * including its production domain preview, current status, and full
 * deployment history.
 */

"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"

// UI Components and Icons
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Rocket,
  CheckCircle2,
  XCircle,
  GitBranch,
  GitCommit,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@workspace/ui/components/button"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

// Define the shape of a deployment object for TypeScript safety
interface Deployment {
  id: string
  projectId: string
  repo: string
  url: string
  status: "queued" | "building" | "ready" | "failed"
  created_at: string
}

// Define the shape of a project from Postgres
interface Project {
  id: string
  name: string
  git_url: string
  sub_domain: string
  created_at: string
}

// Define the shape of a log entry from ClickHouse
interface LogEntry {
  log: string
  timestamp?: string
}

// Resolve the Backend API URL from environment variables
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"

export default function ProjectDetails() {
  // Extract the project UUID from the dynamic route [id]
  const { id: projectId } = useParams()
  const router = useRouter()

  // --- STATE MANAGEMENT ---
  const [project, setProject] = useState<Project | null>(null) // Project metadata (name, git_url, sub_domain)
  const [deployments, setDeployments] = useState<Deployment[]>([]) // History of deployments
  const [logs, setLogs] = useState<string[]>([]) // Snapshot of logs for the latest build
  const [loading, setLoading] = useState(true) // Page-level loading state
  const [activeTab, setActiveTab] = useState("overview") // Navigation state (Overview vs History)

  // Refs for UI interactions
  const logEndRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1) // Auto-scale the iframe preview

  /**
   * Fetches the core project metadata and its entire deployment history.
   */
  const fetchProjectData = useCallback(async () => {
    try {
      // 1. Fetch Project Metadata
      const projectRes = await fetch(
        `${API_BASE_URL}/deployments/projects/${projectId}`
      )
      if (projectRes.ok) {
        const data = await projectRes.json()
        setProject(data.data)
      }

      // 2. Fetch All Deployments for this Project
      const deploymentsRes = await fetch(
        `${API_BASE_URL}/deployments?projectId=${projectId}`
      )
      if (deploymentsRes.ok) {
        const data = await deploymentsRes.json()
        setDeployments(data.data)
      }
    } catch (err) {
      console.error("Error fetching project data:", err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  /**
   * Fetches logs and artifacts for a specific deployment.
   * Usually called for the 'latest' deployment to populate the overview page.
   */
  const fetchLatestLogsAndFiles = useCallback(async (deploymentId: string) => {
    try {
      const logRes = await fetch(`${API_BASE_URL}/logs/${deploymentId}`)
      if (logRes.ok) {
        const data = await logRes.json()
        setLogs(data.data.logs.map((l: LogEntry) => l.log))
      }
    } catch (err) {
      console.error("Error fetching logs:", err)
    }
  }, [])

  /**
   * Lifecycle Hook: Initial data load.
   */
  useEffect(() => {
    fetchProjectData()
  }, [projectId, fetchProjectData])

  // Derived data for display
  const latestDeployment = deployments[0]
  const latestSuccessful = deployments.find((d) => d.status === "ready")
  // The production URL uses the user-defined subdomain (reverse-proxy handles this)
  const productionUrl = latestSuccessful
    ? `http://${project?.sub_domain}.localhost:8080`
    : null

  /**
   * Refresh logs whenever the deployment list changes (e.g., after a new build starts).
   */
  useEffect(() => {
    const latest = deployments[0]
    if (
      latest &&
      (latest.status === "building" ||
        latest.status === "ready" ||
        latest.status === "failed")
    ) {
      fetchLatestLogsAndFiles(latest.id)
    }
  }, [deployments, fetchLatestLogsAndFiles])

  /**
   * Keep logs scrolled to bottom.
   */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  /**
   * Dynamic Preview Scaling:
   * Calculates the scale needed to fit a 1280px wide iframe into the current container.
   */
  useEffect(() => {
    if (!previewContainerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === previewContainerRef.current) {
          const width = entry.contentRect.width
          setPreviewScale(width / 1280)
        }
      }
    })

    observer.observe(previewContainerRef.current)
    return () => observer.disconnect()
  }, [latestSuccessful])

  /**
   * Triggers a new deployment for this project (re-build using same Git URL).
   */
  const handleDeploy = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/deployments/projects/${projectId}/deployments`,
        {
          method: "POST",
        }
      )
      if (res.ok) {
        const response = await res.json()
        const raw = response.data

        // Optimistic UI: Immediately add the 'QUEUED' deployment to the list
        const newDeployment: Deployment = {
          id: raw.id,
          projectId: raw.project_id,
          repo: project?.name || "",
          url: project?.git_url || "",
          status: raw.status.toLowerCase() as Deployment["status"],
          created_at: raw.created_at,
        }

        setDeployments((prev) => [newDeployment, ...prev])
        // Switch to history tab to see the progress
        setActiveTab("deployments")
      }
    } catch (err) {
      console.error("Deployment failed:", err)
    }
  }

  // Global loading state
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-zinc-500" />
      </div>
    )

  return (
    <div className="min-h-screen bg-zinc-950 p-6 font-sans text-zinc-50 sm:p-20">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* --- PAGE HEADER --- */}
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="border border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
              onClick={() => router.push("/")}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                {project?.name || "Project Dashboard"}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <p
                  className="cursor-copy font-mono text-[10px] text-zinc-500 opacity-70 transition-colors active:text-zinc-100"
                  onClick={() =>
                    navigator.clipboard.writeText(projectId as string)
                  }
                  title="Click to copy Project ID"
                >
                  {projectId}
                </p>
                <div className="size-1 rounded-full bg-zinc-800" />
                <a
                  href={project?.git_url}
                  target="_blank"
                  className="text-[10px] text-zinc-500 underline transition-colors hover:text-zinc-300"
                >
                  Source Repository
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* --- NAVIGATION TABS --- */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="w-fit bg-transparent p-1">
            <TabsTrigger
              value="overview"
              className="h-11 px-8 text-[13px] font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="deployments"
              className="h-11 px-8 text-[13px] font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
            >
              Deployments
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB: Vercel-style preview dashboard */}
          <TabsContent
            value="overview"
            className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-2"
          >
            {latestSuccessful ? (
              <div className="grid grid-cols-1 gap-10 pt-4 lg:col-span-12 lg:grid-cols-12">
                {/* --- PREVIEW PANE (Iframe) --- */}
                <div className="lg:col-span-8">
                  <div
                    ref={previewContainerRef}
                    className="group relative flex aspect-video flex-col overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20 shadow-sm transition-all hover:border-zinc-800"
                  >
                    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-black/40">
                      <iframe
                        src={productionUrl!}
                        style={{
                          width: "1280px",
                          height: "720px",
                          // Scaled down to fit the responsive container
                          transform: `scale(${previewScale})`,
                          transformOrigin: "0 0",
                          position: "absolute",
                          top: 0,
                          left: 0,
                          border: "none",
                          pointerEvents: "none", // Avoid accidental clicks in preview
                          opacity: 0.9,
                        }}
                        title="Site Preview"
                        scrolling="no"
                      />
                    </div>
                  </div>
                </div>

                {/* --- METADATA DASHBOARD --- */}
                <div className="flex h-full flex-col space-y-8 py-1 lg:col-span-4">
                  {/* Deployment UUID link */}
                  <div className="space-y-1.5">
                    <span className="text-[12px] font-medium tracking-tight text-zinc-500">
                      Deployment
                    </span>
                    <p
                      className="cursor-pointer truncate text-[13px] font-semibold tracking-tight text-zinc-200 transition-colors hover:text-zinc-50"
                      onClick={() =>
                        latestSuccessful &&
                        window.open(
                          `http://${latestSuccessful.id}.localhost:8080`,
                          "_blank"
                        )
                      }
                    >
                      {latestSuccessful
                        ? `${latestSuccessful.id}.localhost:8080`
                        : "None"}
                    </p>
                  </div>

                  {/* Configured production domain */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium tracking-tight text-zinc-500">
                        Domains
                      </span>
                    </div>
                    <div
                      className="group flex inline-flex cursor-pointer items-center gap-2 transition-colors"
                      onClick={() =>
                        productionUrl && window.open(productionUrl, "_blank")
                      }
                    >
                      <p className="text-[13px] font-semibold text-zinc-200 group-hover:text-zinc-50">
                        {project?.sub_domain}.localhost:8080
                      </p>
                      <ExternalLink className="size-3 text-zinc-600 transition-opacity" />
                    </div>
                  </div>

                  {/* Current Status and Timestamp */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <span className="text-[12px] font-medium tracking-tight text-zinc-500">
                        Status
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-2 rounded-full ${
                            latestDeployment?.status === "ready"
                              ? "bg-emerald-500"
                              : latestDeployment?.status === "failed"
                                ? "bg-red-500"
                                : "animate-pulse bg-blue-500"
                          }`}
                        />
                        <span className="text-[13px] font-semibold text-zinc-200 capitalize">
                          {latestDeployment?.status || "Idle"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[12px] font-medium tracking-tight text-zinc-500">
                        Created
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-300">
                          {latestDeployment
                            ? formatDistanceToNow(
                                new Date(latestDeployment.created_at),
                                { addSuffix: true }
                              )
                            : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Git Source Metadata */}
                  <div className="space-y-2.5">
                    <span className="text-[12px] font-medium tracking-tight text-zinc-500">
                      Source
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 opacity-80">
                        <GitBranch className="size-3.5 text-zinc-500" />
                        <span className="text-[13px] font-semibold text-zinc-200">
                          main
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-60">
                        <GitCommit className="size-3.5 text-zinc-500" />
                        <span className="text-[13px] font-medium text-zinc-400">
                          {latestDeployment?.id.slice(0, 7) || "---"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Empty State
              <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-zinc-900 bg-zinc-900/10 py-32 opacity-50">
                <Rocket className="size-10 text-zinc-700" />
                <p className="text-sm font-medium text-zinc-500">
                  No active deployment found
                </p>
              </div>
            )}
          </TabsContent>

          {/* HISTORY TAB: List of all past and current deployments */}
          <TabsContent
            value="deployments"
            className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-2"
          >
            <div className="flex justify-end">
              <Button
                className="h-10 gap-2 bg-zinc-100 px-6 text-[13px] font-bold text-zinc-950 shadow-lg shadow-white/5 transition-all hover:bg-zinc-200 active:scale-95"
                onClick={handleDeploy}
              >
                <Rocket className="size-4" />
                Create Deployment
              </Button>
            </div>

            <div className="space-y-2">
              {deployments.map((dep) => (
                <div
                  key={dep.id}
                  onClick={() => router.push(`/deployment/${dep.id}`)}
                  className="group/item flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 transition-all hover:border-zinc-700/50 hover:bg-zinc-900/40"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`flex-shrink-0 rounded-lg p-2 ${
                        dep.status === "ready"
                          ? "bg-green-500/10 text-green-500"
                          : dep.status === "failed"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {dep.status === "ready" ? (
                        <CheckCircle2 className="size-4" />
                      ) : dep.status === "failed" ? (
                        <XCircle className="size-4" />
                      ) : (
                        <Loader2 className="size-4 animate-spin text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-400 transition-colors group-hover/item:text-zinc-100">
                          #{dep.id}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ${
                            dep.status === "ready"
                              ? "border-green-500/20 bg-green-500/5 text-green-500/70"
                              : dep.status === "failed"
                                ? "border-red-500/20 bg-red-500/5 text-red-500/70"
                                : "border-blue-500/20 bg-blue-500/5 text-blue-500/70"
                          }`}
                        >
                          {dep.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-zinc-600">
                        {new Date(dep.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="size-4 text-zinc-800 transition-all group-hover/item:translate-x-1 group-hover/item:text-zinc-400" />
                </div>
              ))}
              {deployments.length === 0 && (
                <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 py-20 text-center text-zinc-700 italic">
                  No deployment history found.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
