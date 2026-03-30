/**
 * Deployment Details Page.
 * This client-side component displays the real-time status of a specific
 * deployment. It features live build log streaming (SSE), a list of 
 * generated S3 artifacts, and the final assigned subdomain.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

// UI Components and Icons
import { 
  ChevronLeft, 
  ExternalLink, 
  Terminal, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  Globe, 
  History, 
  Clock, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

// Specialized UI components from the local shadcn/ui library
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

// Define the shape of a deployment object for TypeScript safety
interface Deployment {
  id: string;
  projectId: string;
  repo: string;
  subDomain?: string;
  url: string;
  status: "queued" | "building" | "ready" | "failed";
  created_at: string;
}

// Define the shape of a file metadata object from S3
interface S3File {
  key: string;
  size: number;
  lastModified: string;
}

// Resolve the Backend API URL from environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function DeploymentDetails() {
  // Extract the deployment UUID from the dynamic route [id]
  const { id: deploymentId } = useParams();
  const router = useRouter();
  
  // --- STATE MANAGEMENT ---
  const [deployment, setDeployment] = useState<Deployment | null>(null); // Metadata
  const [logs, setLogs] = useState<string[]>([]); // Current build logs
  const [files, setFiles] = useState<S3File[]>([]); // Generated static files in S3
  const [loading, setLoading] = useState(true); // Initial data load state
  const [expandedItems, setExpandedItems] = useState<string[]>([]); // Control for Accordion UI
  
  // Reference for automatic scrolling of logs
  const logEndRef = useRef<HTMLDivElement>(null);

  /**
   * Fetches the initial snapshot of deployment metadata, historical logs, 
   * and build artifacts.
   */
  const fetchData = async () => {
    try {
      // 1. Fetch Deployment Metadata (Postgres)
      const res = await fetch(`${API_BASE_URL}/deployments/${deploymentId}`);
      if (res.ok) {
        const response = await res.json();
        setDeployment(response.data);
      }

      // 2. Fetch Historical Logs (ClickHouse)
      const logRes = await fetch(`${API_BASE_URL}/logs/${deploymentId}`);
      if (logRes.ok) {
        const response = await logRes.json();
        setLogs(response.data.logs.map((l: any) => l.log));
      }

      // 3. Fetch Build Artifacts (S3)
      const filesRes = await fetch(`${API_BASE_URL}/deployments/${deploymentId}/files`);
      if (filesRes.ok) {
        const response = await filesRes.json();
        setFiles(response.data.files);
      }
    } catch (err) {
      console.error("Error fetching deployment details:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lifecycle Hook: 
   * 1. Fetches initial data.
   * 2. Establishes SSE connections for real-time status and log updates.
   */
  useEffect(() => {
    fetchData();

    // SSE: Stream real-time logs directly from Kafka -> Server -> Browser
    const logEventSource = new EventSource(`${API_BASE_URL}/logs/${deploymentId}/stream`);
    logEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Append new log line to existing state
        setLogs((prev) => [...prev, data.log]);
      } catch (err) {}
    };

    // SSE: Stream global deployment status changes
    const statusEventSource = new EventSource(`${API_BASE_URL}/deployments/stream`);
    statusEventSource.onmessage = (event) => {
      try {
        const all = JSON.parse(event.data);
        // Find the specific deployment being viewed
        const current = all.find((d: any) => d.id === deploymentId);
        if (current) {
          setDeployment(current);
          // If the status just transitioned to 'ready', refresh the artifact list
          if (current.status === "ready") {
             fetch(`${API_BASE_URL}/deployments/${deploymentId}/files`)
              .then(r => r.json())
              .then(d => setFiles(d.data.files));
          }
        }
      } catch (err) {}
    };

    // Cleanup: Close EventSource connections on unmount to prevent memory leaks
    return () => {
      logEventSource.close();
      statusEventSource.close();
    };
  }, [deploymentId]);

  /**
   * Automatic Scroll: Keeps the log view at the bottom (most recent lines).
   */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Handle initial loading state
  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="size-8 text-zinc-500 animate-spin" />
    </div>
  );

  // Handle 'Not Found' or error state
  if (!deployment) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <AlertCircle className="size-8 text-red-500" />
      <p className="text-zinc-400">Deployment not found.</p>
      <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 sm:p-20 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* --- PAGE HEADER --- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                className="text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
                onClick={() => router.back()}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Deployment <span className="text-zinc-500 font-mono text-sm ml-2">#{deployment.id.slice(0, 8)}</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {/* Backlink to the main project history */}
                <button 
                  onClick={() => router.push(`/project/${deployment.projectId}`)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono cursor-pointer"
                >
                  Project: {deployment.repo}
                </button>
                <div className="size-1 rounded-full bg-zinc-800" />
                <p className="text-[10px] text-zinc-500">{formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}</p>
              </div>
            </div>
          </div>
          
          {/* --- STATUS BADGE --- */}
          <div className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border flex items-center gap-2 shadow-sm ${
              deployment.status === "ready" ? "bg-green-500/10 text-green-500 border-green-500/20" :
              deployment.status === "failed" ? "bg-red-500/10 text-red-500 border-red-500/20" :
              "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse"
          }`}>
             {deployment.status === "building" && <Loader2 className="size-3 animate-spin" />}
             {deployment.status}
          </div>
        </div>


        {/* --- ACCORDION SECTIONS: Logs -> Artifacts -> Domain --- */}
        <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems} className="space-y-4">
          
          {/* BUILD LOGS SECTION */}
          <AccordionItem 
            value="logs" 
            disabled={deployment.status === "queued"}
            className={`border border-zinc-900 rounded-xl overflow-hidden bg-zinc-900/20 ${deployment.status === "queued" && 'opacity-30'}`}
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
               <div className="flex items-center gap-3">
                  <Terminal className="size-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Build Logs</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="bg-black/40 rounded-lg border border-zinc-800 p-4 h-[400px] overflow-y-auto font-mono text-[11px] leading-relaxed">
                {logs.length === 0 ? (
                    <div className="text-zinc-700 italic text-center py-6">No logs available for this build phase.</div>
                ) : (
                    logs.map((log, i) => (
                      <div key={i} className="mb-0.5 text-zinc-400 font-mono">
                        <span className="text-zinc-700 mr-2 select-none">{(i+1).toString().padStart(3, '0')}</span>
                        {log}
                      </div>
                    ))
                )}
                <div ref={logEndRef} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* BUILD ARTIFACTS SECTION: Only enabled if deployment is READY */}
          <AccordionItem 
            value="summary" 
            disabled={deployment.status !== "ready" || files.length === 0} 
            className={`border border-zinc-900 rounded-xl overflow-hidden bg-zinc-900/20 ${(deployment.status !== "ready" || files.length === 0) && 'opacity-30 transition-opacity'}`}
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
               <div className="flex items-center gap-3">
                  <ShieldCheck className="size-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Build Artifacts</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
               <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2">
                     {files.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-800/50 rounded-lg text-[11px] hover:border-zinc-700 transition-colors">
                           <span className="text-zinc-300 font-mono truncate max-w-[500px]">{file.key}</span>
                           <span className="text-zinc-600">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                     ))}
                  </div>
               </div>
            </AccordionContent>
          </AccordionItem>

          {/* CUSTOM DOMAIN SECTION: Provides the proxied localhost:8080 link */}
          <AccordionItem 
            value="domain" 
            disabled={deployment.status !== "ready"}
            className={`border border-zinc-900 rounded-xl overflow-hidden bg-zinc-900/20 ${deployment.status !== "ready" && 'opacity-30'}`}
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
               <div className="flex items-center gap-3">
                  <Globe className="size-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Custom Assigned Domain</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
               <div 
                 className="p-4 bg-zinc-950/40 border border-zinc-800/50 rounded-lg flex items-center justify-between group/link hover:border-zinc-700 transition-colors cursor-pointer" 
                 onClick={() => window.open(`http://${deployment.id}.localhost:8080`, "_blank")}
               >
                  <div className="flex items-center gap-3">
                     <Globe className="size-4 text-zinc-500" />
                     <span className="text-sm font-medium text-zinc-300 group-hover/link:text-zinc-100 transition-colors">{deployment.id}.localhost:8080</span>
                  </div>
                  <ExternalLink className="size-3.5 text-zinc-700 group-hover/link:text-zinc-500 transition-colors" />
               </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
