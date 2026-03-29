"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Terminal, ShieldCheck, AlertCircle, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

interface LogEntry {
  log: string;
}

interface S3File {
  key: string;
  size: number;
  lastModified: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function ProjectDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("loading");
  const [repo, setRepo] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [files, setFiles] = useState<S3File[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/deployments/${id}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Error fetching files:", err);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/deployments`);
        if (res.ok) {
          const all = await res.json();
          const current = all.find((d: any) => d.id === id);
          if (current) {
            setRepo(current.repo);
            setStatus(current.status);
            setUrl(current.url);
            if (current.status === "ready") fetchFiles();
          }
        }
        
        const logRes = await fetch(`${API_BASE_URL}/logs/${id}`);
        if (logRes.ok) {
          const data = await logRes.json();
          setLogs(data.logs.map((l: any) => l.log));
        }
      } catch (err) {
        console.error("Metadata fetch error:", err);
      }
    };

    fetchMetadata();

    const logEventSource = new EventSource(`${API_BASE_URL}/logs/${id}/stream`);
    logEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, data.log]);
      } catch (err) {}
    };

    const statusEventSource = new EventSource(`${API_BASE_URL}/deployments/stream`);
    statusEventSource.onmessage = (event) => {
      try {
        const all = JSON.parse(event.data);
        const current = all.find((d: any) => d.id === id);
        if (current) {
          if (current.status === "ready" && status !== "ready") fetchFiles();
          setStatus(current.status);
          setUrl(current.url);
        }
      } catch (err) {}
    };

    return () => {
      logEventSource.close();
      statusEventSource.close();
    };
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const isReady = status === "ready";

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
                onClick={() => router.push("/")}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">{repo || "Deployment"}</h1>
              <p className="text-xs text-zinc-500 font-mono mt-1 opacity-70 cursor-copy" onClick={() => navigator.clipboard.writeText(id as string)}>
                {id}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border flex items-center gap-2 shadow-sm ${
                 status === "ready" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                 status === "failed" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                 "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse"
             }`}>
                {status === "building" && <Loader2 className="size-3 animate-spin" />}
                {status}
             </div>
          </div>
        </div>

        {/* Accordion Sections */}
        <Accordion type="multiple" defaultValue={["logs"]} className="space-y-4">
          
          <AccordionItem value="logs" className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-900/20">
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
               <div className="flex items-center gap-3">
                  <Terminal className="size-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Build Logs</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="bg-black/40 rounded-lg border border-zinc-800 p-4 h-[400px] overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800">
                {logs.length === 0 ? (
                    <div className="text-zinc-700 italic">Initializing build pipeline...</div>
                ) : (
                    logs.map((log, i) => <div key={i} className="mb-0.5 text-zinc-400"><span className="text-zinc-700 mr-2 select-none">{(i+1).toString().padStart(3, '0')}</span>{log}</div>)
                )}
                <div ref={logEndRef} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="summary" disabled={!isReady} className={`border border-zinc-900 rounded-xl overflow-hidden bg-zinc-900/20 ${!isReady && 'opacity-40'}`}>
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
               <div className="flex items-center gap-3">
                  <ShieldCheck className="size-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Deployment Summary</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
               <div className="space-y-4">
                  <p className="text-xs text-zinc-500">The following build artifacts were successfully generated and uploaded to S3.</p>
                  <div className="grid grid-cols-1 gap-2">
                     {files.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-[11px]">
                           <span className="text-zinc-300 font-mono truncate max-w-[300px]">{file.key}</span>
                           <span className="text-zinc-600">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                     ))}
                  </div>
               </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="domain" disabled={!isReady} className={`border border-zinc-900 rounded-xl overflow-hidden bg-zinc-900/20 ${!isReady && 'opacity-40'}`}>
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
               <div className="flex items-center gap-3">
                  <Globe className="size-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Custom Domains</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-zinc-900/50 border border-dashed border-zinc-700 rounded-lg">
                  <div className="space-y-1">
                     <p className="text-xs font-semibold text-zinc-300">{url.replace("http://", "")}</p>
                     <p className="text-[10px] text-zinc-500">Primary local deployment domain</p>
                  </div>
                  <Button 
                    className="bg-zinc-100 text-zinc-900 hover:bg-white gap-2 h-8 px-4 text-[11px] font-bold transition-all"
                    onClick={() => window.open(url, "_blank")}
                  >
                    Visit Site <ExternalLink className="size-3" />
                  </Button>
               </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>

      </div>
    </div>
  );
}
