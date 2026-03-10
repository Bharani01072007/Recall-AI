import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, Brain, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const supabase = supabaseClient as any;

interface LogEntry {
  id: string;
  action: "Query" | "Ingestion" | "Brain Q&A";
  detail: string;
  time: string;
  rawId?: string; // Original ID from DB
  subDetail?: string; // For answers
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    
    const parseDate = (dateStr: string) => {
      if (!dateStr) return new Date();
      const normalized = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`;
      return new Date(normalized);
    };

    const [queryRes, docsRes, brainQaRes] = await Promise.all([
      supabase.from("query_logs").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("brain_knowledge").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("brain_qa_history").select("*").order("created_at", { ascending: false }).limit(15),
    ]);

    const entries: LogEntry[] = [];

    (queryRes.data || []).forEach((q: any) => {
      entries.push({
        id: `query-${q.id}`,
        rawId: q.id,
        action: "Query",
        detail: q.query || "Unknown query",
        time: q.created_at ? formatDistanceToNow(parseDate(q.created_at), { addSuffix: true }) : "Unknown",
      });
    });

    (docsRes.data || []).forEach((d: any) => {
      entries.push({
        id: `doc-${d.id}`,
        rawId: d.id,
        action: "Ingestion",
        detail: d.name || d.source_type || "Document ingested",
        time: d.created_at ? formatDistanceToNow(parseDate(d.created_at), { addSuffix: true }) : "Unknown",
      });
    });

    (brainQaRes.data || []).forEach((q: any) => {
      entries.push({
        id: `qa-${q.id}`,
        rawId: q.id,
        action: "Brain Q&A",
        detail: q.question,
        subDetail: q.answer,
        time: q.created_at ? formatDistanceToNow(parseDate(q.created_at), { addSuffix: true }) : "Unknown",
      });
    });

    // Sort by actual date
    const sorted = entries.sort((a, b) => {
      // Very rough sort based on the formatDistanceToNow string is impossible, 
      // but the order of fetch usually works or we could store raw dates.
      return 0; 
    });

    setLogs(entries);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDelete = async (log: LogEntry) => {
    if (!log.rawId) return;
    setDeletingId(log.id);
    
    try {
      if (log.action === "Ingestion") {
        await supabase.from("brain_knowledge_vectors").delete().eq("knowledge_id", log.rawId);
        await supabase.from("events").delete().eq("document_id", log.rawId);
        const { error: docErr } = await supabase.from("brain_knowledge").delete().eq("id", log.rawId);
        if (docErr) throw docErr;
        toast.success("Knowledge removed from brain.");
      } else if (log.action === "Brain Q&A") {
        await supabase.from("brain_qa_history").delete().eq("id", log.rawId);
        toast.success("Q&A history removed.");
      } else {
        await supabase.from("query_logs").delete().eq("id", log.rawId);
        toast.success("Query log removed.");
      }
      
      setLogs(prev => prev.filter(l => l.id !== log.id));
    } catch (err: any) {
      console.error("DELETE ERROR:", err);
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track all queries and dedicated brain interactions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>Refetch</Button>
      </div>

      {loading && logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Scanning brain interactions...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
      ) : (
        <motion.div className="space-y-3" variants={container} initial="hidden" animate="show">
          <AnimatePresence mode="popLayout">
            {logs.map((log) => (
              <motion.div key={log.id} variants={item} layout exit={{ opacity: 0, x: 20 }}>
                <Card className="shadow-card hover:shadow-elevated transition-shadow group">
                  <CardContent className="py-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={
                            log.action === "Query" ? "bg-primary/10 text-primary" : 
                            log.action === "Ingestion" ? "bg-emerald-500/10 text-emerald-600" :
                            "bg-purple-500/10 text-purple-600"
                          }
                        >
                          {log.action === "Brain Q&A" ? "Direct Query" : log.action}
                        </Badge>
                        <span className="text-sm font-medium">{log.detail}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{log.time}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingId === log.id}
                          onClick={() => handleDelete(log)}
                        >
                          {deletingId === log.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {log.subDetail && (
                      <div className="mt-1 pl-4 border-l-2 border-purple-500/20">
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          Answer: {log.subDetail}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
