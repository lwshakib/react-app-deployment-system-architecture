"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Cpu, CheckCircle2, Clock, Globe, Trash2, ChevronRight } from "lucide-react";
import { FaGithub as Github } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Deployment {
  id: string;
  url: string;
  repo: string;
  status: "queued" | "building" | "ready" | "failed";
  created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function Home() {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState("");
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // SSE: Stream deployments for real-time dashboard updates
    const eventSource = new EventSource(`${API_BASE_URL}/deployments/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setDeployments(data);
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  const handleDeploy = async () => {
    if (!githubUrl || !githubUrl.includes("github.com")) return;

    setLoading(true);
    try {
      const repoName = githubUrl.split("/").pop()?.replace(".git", "") || "unknown-repo";

      const response = await fetch(`${API_BASE_URL}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoName, url: githubUrl }),
      });

      if (response.ok) {
        setGithubUrl("");
      }
    } catch (error) {
      console.error("Error creating deployment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Don't navigate when deleting
    if (!confirm("Are you sure?")) return;

    try {
      await fetch(`${API_BASE_URL}/deployments/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error deleting deployment:", error);
    }
  };

  const getStatusIcon = (status: Deployment["status"]) => {
    switch (status) {
      case "queued": return <Clock className="size-3 text-zinc-500 animate-pulse" />;
      case "building": return <Cpu className="size-3 text-blue-500 animate-spin" />;
      case "ready": return <CheckCircle2 className="size-3 text-green-500" />;
      case "failed": return <div className="size-1.5 rounded-full bg-red-500" />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 text-zinc-50 font-sans p-6 sm:p-20">
      
      {/* Hero Section */}
      <div className="flex flex-col items-start sm:items-center gap-8 w-full max-w-xl mt-20 mb-20 sm:text-center">
        <div className="flex flex-col items-start sm:items-center gap-4">
          <div className="rounded-md bg-zinc-900 p-3 border border-zinc-800">
            <Rocket className="size-6 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Deploy in Seconds</h1>
            <p className="text-base text-zinc-400 max-w-md mx-auto">
              Real-time infrastructure for your React applications.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
          <div className="relative flex-1">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="https://github.com/username/repo"
              className="h-10 pl-10 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-1 focus-visible:ring-zinc-700 placeholder:text-zinc-600"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDeploy()}
            />
          </div>
          <Button 
            className="h-10 px-6 bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
            onClick={handleDeploy}
            disabled={!githubUrl || loading}
          >
            {loading ? "Deploying..." : "Deploy"}
          </Button>
        </div>
      </div>

      {/* Deployment List */}
      {deployments.length > 0 && (
        <div className="w-full max-w-2xl space-y-2">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-1 mb-4 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            <div className="flex items-center gap-1.5"><Globe className="size-3" /> Recent Projects</div>
          </div>
          
          <div className="flex flex-col">
            {deployments.map((deployment) => (
              <div 
                key={deployment.id} 
                onClick={() => router.push(`/project/${deployment.id}`)}
                className="group flex items-center justify-between py-4 px-2 hover:bg-zinc-900/50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-zinc-800/50 mb-1"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="bg-zinc-900 p-2 rounded-md border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                    <Github className="size-4 text-zinc-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-200 truncate">{deployment.repo}</span>
                    <span className="text-[10px] text-zinc-500 truncate opacity-60">ID: {deployment.id.split("-")[0]}...</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 min-w-[80px]">
                    {getStatusIcon(deployment.status)}
                    <span className="text-[11px] text-zinc-400 capitalize">{deployment.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                      onClick={(e) => handleDelete(e, deployment.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <ChevronRight className="size-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExternalLink({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}
