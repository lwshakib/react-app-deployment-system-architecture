"use client";

import { useState } from "react";
import { Rocket, Cpu, CheckCircle2, Clock, Globe } from "lucide-react";
import { FaGithub as Github } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Deployment {
  id: string;
  url: string;
  repo: string;
  status: "queued" | "building" | "ready" | "failed";
  createdAt: string;
}

export default function Home() {
  const [githubUrl, setGithubUrl] = useState("");
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  const handleDeploy = () => {
    if (!githubUrl || !githubUrl.includes("github.com")) return;

    // Extract repo name from URL
    const repoName = githubUrl.split("/").pop() || "unknown-repo";

    const newDeployment: Deployment = {
      id: Math.random().toString(36).substring(7),
      url: githubUrl,
      repo: repoName,
      status: "queued",
      createdAt: new Date().toLocaleTimeString(),
    };

    setDeployments((prev) => [newDeployment, ...prev]);
    setGithubUrl("");

    // Simulate deployment progression
    setTimeout(() => {
      updateStatus(newDeployment.id, "building");
      setTimeout(() => {
        updateStatus(newDeployment.id, "ready");
      }, 3000);
    }, 1500);
  };

  const updateStatus = (id: string, status: Deployment["status"]) => {
    setDeployments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status } : d))
    );
  };

  const getStatusIcon = (status: Deployment["status"]) => {
    switch (status) {
      case "queued": return <Clock className="size-4 text-zinc-500 animate-pulse" />;
      case "building": return <Cpu className="size-4 text-blue-500 animate-spin" />;
      case "ready": return <CheckCircle2 className="size-4 text-green-500" />;
      case "failed": return <div className="size-2 rounded-full bg-red-500" />;
    }
  };

  const getStatusBadgeVariant = (status: Deployment["status"]) => {
    switch (status) {
      case "queued": return "secondary";
      case "building": return "default";
      case "ready": return "outline";
      case "failed": return "destructive";
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
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
              Deploy in Seconds
            </h1>
            <p className="text-base text-zinc-400 max-w-md mx-auto">
              The fastest way to deploy your React applications directly from GitHub. Simple and secure.
            </p>
          </div>
        </div>

        {/* Input Box */}
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
            disabled={!githubUrl}
          >
            Deploy
          </Button>
        </div>
      </div>

      {/* Deployment List */}
      {deployments.length > 0 && (
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Globe className="size-3" />
              Active Deployments
            </h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {deployments.map((deployment) => (
              <Card 
                key={deployment.id} 
                className="bg-zinc-950 border-zinc-800 rounded-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-2">
                      <Github className="size-4 text-zinc-400" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-medium text-zinc-200">
                        {deployment.repo}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="truncate max-w-[200px] sm:max-w-[180px]">
                          {deployment.url}
                        </span>
                        <span>•</span>
                        <span>{deployment.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deployment.status)}
                      <Badge variant={getStatusBadgeVariant(deployment.status)} className="capitalize font-medium text-[10px] sm:text-xs">
                        {deployment.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-300">
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
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
