"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Cpu, CheckCircle2, Clock, Globe, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { FaGithub as Github } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

interface Deployment {
  id: string;
  projectId: string;
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

  const fetchDeployments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/deployments`);
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.data);
      }
    } catch (error) {
      console.error("Error fetching deployments:", error);
    }
  };

  useEffect(() => {
    fetchDeployments();
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
        fetchDeployments();
      }
    } catch (error) {
      console.error("Error creating deployment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/deployments/${id}`, { method: "DELETE" });
      fetchDeployments();
    } catch (error) {
      console.error("Error deleting deployment:", error);
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
        <div className="w-full max-w-xl px-4 sm:px-0">
          <div className="flex flex-col">
            {deployments.map((deployment) => (
              <div 
                key={deployment.id} 
                onClick={() => router.push(`/project/${deployment.projectId}`)}
                className="group flex items-center justify-between py-3 hover:bg-zinc-900/40 transition-all cursor-pointer px-4 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Github className="size-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  <span className="text-[13px] font-medium text-zinc-300 truncate">{deployment.repo}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the deployment for <span className="text-zinc-100 font-medium">{deployment.repo}</span> and remove all associated build artifacts from S3.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(deployment.id);
                            }}
                          >
                            Delete Deployment
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
