"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Terminal, AlertCircle, Loader2, Globe, Rocket, History, Clock, CheckCircle2, XCircle, ShieldCheck, GitBranch, GitCommit, Plus, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

interface Deployment {
  id: string;
  projectId: string;
  repo: string;
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

export default function ProjectDetails() {
  const { id: projectId } = useParams();
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const fetchProjectData = async () => {
    try {
      // 1. Fetch Project Metadata
      const projectRes = await fetch(`${API_BASE_URL}/deployments/projects/${projectId}`);
      if (projectRes.ok) {
        const data = await projectRes.json();
        setProject(data.data);
      }

      // 2. Fetch All Deployments for Project
      const deploymentsRes = await fetch(`${API_BASE_URL}/deployments?projectId=${projectId}`);
      if (deploymentsRes.ok) {
        const data = await deploymentsRes.json();
        setDeployments(data.data);
      }
    } catch (err) {
      console.error("Error fetching project data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestLogsAndFiles = async (deploymentId: string) => {
    try {
      const logRes = await fetch(`${API_BASE_URL}/logs/${deploymentId}`);
      if (logRes.ok) {
        const data = await logRes.json();
        setLogs(data.data.logs.map((l: any) => l.log));
      }

      const filesRes = await fetch(`${API_BASE_URL}/deployments/${deploymentId}/files`);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.data.files);
      }
    } catch (err) {
      console.error("Error fetching logs/files:", err);
    }
  };

  useEffect(() => {
    fetchProjectData();

    return () => {};
  }, [projectId]);

  const latestDeployment = deployments[0];
  const latestSuccessful = deployments.find(d => d.status === "ready");
  const productionUrl = latestSuccessful ? `http://${project?.sub_domain}.localhost:8080` : null;

  useEffect(() => {
    const latest = deployments[0];
    if (latest && (latest.status === "building" || latest.status === "ready" || latest.status === "failed")) {
      fetchLatestLogsAndFiles(latest.id);
    }
  }, [deployments]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ResizeObserver for Preview Scaling
  useEffect(() => {
    if (!previewContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === previewContainerRef.current) {
          const width = entry.contentRect.width;
          setPreviewScale(width / 1280);
        }
      }
    });

    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [latestSuccessful]);

  const handleDeploy = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/deployments/projects/${projectId}/deployments`, {
        method: "POST"
      });
      if (res.ok) {
        const response = await res.json();
        const raw = response.data;
        
        // Instant Preview: Add the new deployment to the list immediately
        const newDeployment: Deployment = {
          id: raw.id,
          projectId: raw.project_id,
          repo: project.name,
          url: project.git_url,
          status: raw.status.toLowerCase() as any,
          created_at: raw.created_at
        };

        setDeployments((prev) => [newDeployment, ...prev]);
      }
    } catch (err) {
      console.error("Deployment failed:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="size-8 text-zinc-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 sm:p-20 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                className="text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
                onClick={() => router.push("/")}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">{project?.name || "Project Dashboard"}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] text-zinc-500 font-mono opacity-70 cursor-copy" onClick={() => navigator.clipboard.writeText(projectId as string)}>
                  {projectId}
                </p>
                <div className="size-1 rounded-full bg-zinc-800" />
                <a href={project?.git_url} target="_blank" className="text-[10px] text-zinc-500 hover:text-zinc-300 underline transition-colors">Source Repository</a>
              </div>
            </div>
          </div>
          
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-transparent  p-1 w-fit">
            <TabsTrigger value="overview" className="h-11 px-8 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 font-semibold text-[13px]">Overview</TabsTrigger>
            <TabsTrigger value="deployments" className="h-11 px-8 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 font-semibold text-[13px]">Deployments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Vercel-Style Preview & Dashboard */}
            {latestSuccessful ? (
              <div className="grid grid-cols-1 lg:col-span-12 lg:grid-cols-12 gap-10 pt-4">
                {/* Left: 16:9 Preview Pane */}
                <div className="lg:col-span-8">
                  <div 
                    ref={previewContainerRef}
                    className="relative aspect-video bg-zinc-900/20 border border-zinc-900 rounded-xl overflow-hidden shadow-sm flex flex-col group transition-all hover:border-zinc-800"
                  >
                    <div className="flex-1 bg-black/40 flex flex-col items-center justify-center relative overflow-hidden">
                      <iframe 
                        src={productionUrl!} 
                        style={{
                          width: "1280px",
                          height: "720px",
                          transform: `scale(${previewScale})`,
                          transformOrigin: "0 0",
                          position: "absolute",
                          top: 0,
                          left: 0,
                          border: "none",
                          pointerEvents: "none",
                          opacity: 0.9,
                        }}
                        title="Site Preview"
                        scrolling="no"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Minimalist Metadata Dashboard */}
                <div className="lg:col-span-4 space-y-8 h-full flex flex-col py-1">
                  {/* Deployment section: Latest Successful Build URL */}
                  <div className="space-y-1.5">
                    <span className="text-[12px] text-zinc-500 font-medium tracking-tight">Deployment</span>
                    <p 
                      className="text-[13px] font-semibold text-zinc-200 truncate tracking-tight hover:text-zinc-50 cursor-pointer transition-colors"
                      onClick={() => latestSuccessful && window.open(`http://${latestSuccessful.id}.localhost:8080`, "_blank")}
                    >
                      {latestSuccessful ? `${latestSuccessful.id}.localhost:8080` : "None"}
                    </p>
                  </div>

                  {/* Domains section: Main Subdomain */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-zinc-500 font-medium tracking-tight">Domains</span>
                    </div>
                    <div 
                      className="flex items-center gap-2 group cursor-pointer inline-flex transition-colors"
                      onClick={() => productionUrl && window.open(productionUrl, "_blank")}
                    >
                      <p className="text-[13px] font-semibold text-zinc-200 group-hover:text-zinc-50">
                        {project?.sub_domain}.localhost:8080
                      </p>
                      <ExternalLink className="size-3 text-zinc-600 transition-opacity" />
                    </div>
                  </div>

                  {/* Status & Created grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <span className="text-[12px] text-zinc-500 font-medium tracking-tight">Status</span>
                      <div className="flex items-center gap-2">
                        <div className={`size-2 rounded-full ${
                          latestDeployment?.status === "ready" ? "bg-emerald-500" :
                          latestDeployment?.status === "failed" ? "bg-red-500" :
                          "bg-blue-500 animate-pulse"
                        }`} />
                        <span className="text-[13px] font-semibold text-zinc-200 capitalize">
                          {latestDeployment?.status || "Idle"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[12px] text-zinc-500 font-medium tracking-tight">Created</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-300">
                          {latestDeployment ? formatDistanceToNow(new Date(latestDeployment.created_at), { addSuffix: true }) : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Source section */}
                  <div className="space-y-2.5">
                    <span className="text-[12px] text-zinc-500 font-medium tracking-tight">Source</span>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 opacity-80 hover:opacity-100 cursor-pointer transition-opacity">
                        <GitBranch className="size-3.5 text-zinc-500" />
                        <span className="text-[13px] font-semibold text-zinc-200">main</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-60 hover:opacity-100 cursor-pointer transition-opacity">
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
              <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/10 border border-zinc-900 rounded-2xl border-dashed opacity-50 space-y-4">
                <Rocket className="size-10 text-zinc-700" />
                <p className="text-sm font-medium text-zinc-500">No active deployment found</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="deployments" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <div className="flex justify-end">
              <Button 
                className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200 gap-2 font-bold px-6 h-10 shadow-lg shadow-white/5 active:scale-95 transition-all text-[13px]"
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
                     className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl gap-4 hover:border-zinc-700/50 hover:bg-zinc-900/40 cursor-pointer transition-all group/item"
                 >
                    <div className="flex items-center gap-4 min-w-0">
                       <div className={`flex-shrink-0 p-2 rounded-lg ${
                         dep.status === "ready" ? "bg-green-500/10 text-green-500" :
                         dep.status === "failed" ? "bg-red-500/10 text-red-500" :
                         "bg-blue-500/10 text-blue-500"
                       }`}>
                         {dep.status === "ready" ? <CheckCircle2 className="size-4" /> :
                          dep.status === "failed" ? <XCircle className="size-4" /> :
                          <Loader2 className="size-4 animate-spin text-blue-500" />}
                       </div>
                       <div className="min-w-0 truncate">
                          <div className="flex items-center gap-2">
                             <span className="text-[11px] font-mono text-zinc-400 group-hover/item:text-zinc-100 transition-colors">#{dep.id}</span>
                             <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-widest border ${
                                dep.status === "ready" ? "bg-green-500/5 border-green-500/20 text-green-500/70" :
                                dep.status === "failed" ? "bg-red-500/5 border-red-500/20 text-red-500/70" :
                                "bg-blue-500/5 border-blue-500/20 text-blue-500/70"
                             }`}>
                                {dep.status}
                             </span>
                          </div>
                          <p className="text-[10px] text-zinc-600 mt-1 font-medium">{new Date(dep.created_at).toLocaleString()}</p>
                       </div>
                    </div>
                    
                    <ChevronRight className="size-4 text-zinc-800 group-hover/item:text-zinc-400 group-hover/item:translate-x-1 transition-all" />
                 </div>
               ))}
               {deployments.length === 0 && (
                  <div className="text-zinc-700 text-center py-20 italic bg-zinc-900/10 border border-zinc-900 rounded-2xl">
                    No deployment history found.
                  </div>
               )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

