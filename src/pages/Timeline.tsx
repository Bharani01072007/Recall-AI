import { useEffect, useState } from "react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, Clock, Brain, FileText, CheckCircle2, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const supabase = supabaseClient as any;

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  event_date: string | null;
  source: string | null;
  is_completed: boolean;
}

const typeColors: Record<string, string> = {
  Meeting: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Deadline: "bg-red-500/10 text-red-500 border-red-500/20",
  Reminder: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Announcement: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", startOfToday)
        .order("event_date", { ascending: true });

      if (error) throw error;
      
      // Filter out locally finished events
      const localFinished = JSON.parse(localStorage.getItem("recall_finished_events") || "[]");
      const activeEvents = (data || []).filter((ev: any) => !localFinished.includes(ev.id));
      
      setEvents(activeEvents);
    } catch (err) {
      console.error("Timeline error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    const channel = supabase
      .channel("timeline-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => fetchEvents())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <History className="h-8 w-8 text-primary" />
          Upcoming Timeline
        </h1>
        <p className="text-muted-foreground mt-1">A chronological list of your upcoming events and information.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse">
          Retrieving history...
        </div>
      ) : events.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No upcoming events found in your timeline yet.</p>
        </div>
      ) : (
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-emerald-500/20 before:to-transparent">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
            >
              {/* Dot */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-emerald-500/20 bg-slate-950 z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl shadow-emerald-500/5 transition-transform group-hover:scale-110">
                {event.is_completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>

              {/* Content */}
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 glass hover:border-emerald-500/30 transition-all">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${typeColors[event.event_type || ""] || ""}`}>
                      {event.event_type || "Event"}
                    </Badge>
                    <time className="text-[10px] font-mono text-muted-foreground">
                      {event.event_date ? format(new Date(event.event_date), "MMM d, yyyy") : "No Date"}
                    </time>
                  </div>
                  
                  <h3 className={`font-display font-bold text-sm ${event.is_completed ? "line-through opacity-50" : ""}`}>
                    {event.title}
                  </h3>
                  
                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      "{event.description}"
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-500/5">
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <Brain className="h-3 w-3" />
                      <span>RecallAI Memory</span>
                    </div>
                    {event.source && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{event.source}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
