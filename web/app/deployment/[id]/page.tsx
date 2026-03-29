"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Terminal, ShieldCheck, AlertCircle, Loader2, Globe, History, Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

interface Deployment {
  id: string;
  projectId: string;
  repo: string;
  subDomain?: string;
  url: string;
  status: "queued" | "building" | "ready" | "failed";
  created_at: string;
}

interface S3File {
  key: string;
  size: number;
  lastModified: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function DeploymentDetails() {
  const { id: deploymentId } = useParams();
  const router = useRouter();
  
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      // 1. Fetch Deployment Metadata
      const res = await fetch(`${API_BASE_URL}/deployments/${deploymentId}`);
      if (res.ok) {
        const response = await res.json();
        setDeployment(response.data);
      }

      // 2. Fetch Logs
      const logRes = await fetch(`${API_BASE_URL}/logs/${deploymentId}`);
      if (logRes.ok) {
        const response = await logRes.json();
        setLogs(response.data.logs.map((l: any) => l.log));
      }

      // 3. Fetch Files
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

  useEffect(() => {
    fetchData();

    // SSE: Stream logs if building
    const logEventSource = new EventSource(`${API_BASE_URL}/logs/${deploymentId}/stream`);
    logEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, data.log]);
      } catch (err) {}
    };

    // SSE: Stream status changes
    const statusEventSource = new EventSource(`${API_BASE_URL}/deployments/stream`);
    statusEventSource.onmessage = (event) => {
      try {
        const all = JSON.parse(event.data);
        const current = all.find((d: any) => d.id === deploymentId);
        if (current) {
          setDeployment(current);
          if (current.status === "ready") {
             // Re-fetch files immediately if it just finished
             fetch(`${API_BASE_URL}/deployments/${deploymentId}/files`)
              .then(r => r.json())
              .then(d => setFiles(d.data.files));
          }
        }
      } catch (err) {}
    };

    return () => {
      logEventSource.close();
      statusEventSource.close();
    };
  }, [deploymentId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="size-8 text-zinc-500 animate-spin" />
    </div>
  );

  if (!deployment) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <AlertCircle className="size-8 text-red-500" />
      <p className="text-zinc-400">Deployment not found.</p>
      <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
    </div>
  );

  const specificUrl = `http://${deployment.id}.localhost:8080`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 sm:p-20 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Header */}
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
          
          <div className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border flex items-center gap-2 shadow-sm ${
              deployment.status === "ready" ? "bg-green-500/10 text-green-500 border-green-500/20" :
              deployment.status === "failed" ? "bg-red-500/10 text-red-500 border-red-500/20" :
              "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse"
          }`}>
             {deployment.status === "building" && <Loader2 className="size-3 animate-spin" />}
             {deployment.status}
          </div>
        </div>


        {/* Accordion Sections: Logs -> Artifacts -> Domain */}
        <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems} className="space-y-4">
          
          {/* Build Logs: Enabled if Building, Ready, or Failed */}
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
                    logs.map((log, i) => <div key={i} className="mb-0.5 text-zinc-400 font-mono"><span className="text-zinc-700 mr-2 select-none">{(i+1).toString().padStart(3, '0')}</span>{log}</div>)
                )}
                <div ref={logEndRef} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Build Artifacts: Only Enabled if READY */}
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

          {/* Custom Domain: Only Enabled if READY */}
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
               <div className="p-4 bg-zinc-950/40 border border-zinc-800/50 rounded-lg flex items-center justify-between group/link hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => window.open(`http://${deployment.id}.localhost:8080`, "_blank")}>
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
