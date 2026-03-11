import { useEffect, useState } from "react";
import { Calendar, Clock, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

const supabase = supabaseClient as any;

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  event_date: string | null;
  source: string | null;
  is_completed?: boolean;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const typeColors: Record<string, string> = {
  Meeting: "bg-primary/10 text-primary",
  Deadline: "bg-destructive/10 text-destructive",
  Reminder: "bg-secondary/10 text-secondary",
  Announcement: "bg-accent text-accent-foreground",
};

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState({
    contexts: 0,
    deadlines: 0,
    eventsThisWeek: 0,
    recentEntries: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      // Only show events from today onwards for the list
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + 7);
      const endOfWeekIso = endOfWeek.toISOString();

      const [eventsRes, brainDocsRes, qaRes, totalEventsRes, deadlinesRes, weekEventsRes] = await Promise.all([
        supabase.from("events")
          .select("*")
          .gte("event_date", startOfToday)
          .order("event_date", { ascending: true })
          .limit(15),
        supabase.from("brain_knowledge").select("id", { count: "exact", head: true }),
        supabase.from("brain_qa_history").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("event_type", "Deadline").gte("event_date", startOfToday),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", startOfToday).lte("event_date", endOfWeekIso),
      ]);

      if (eventsRes.error) throw eventsRes.error;

      // Get local completion overrides
      const localFinished = JSON.parse(localStorage.getItem("recall_finished_events") || "[]");

      const mergedEvents = (eventsRes.data as Event[] || []).map(ev => ({
        ...ev,
        is_completed: localFinished.includes(ev.id) || ev.is_completed
      }));

      setEvents(mergedEvents);

      setStats({
        contexts: (brainDocsRes.count ?? 0) + (qaRes.count ?? 0),
        deadlines: deadlinesRes.count ?? 0,
        eventsThisWeek: weekEventsRes.count ?? 0,
        recentEntries: totalEventsRes.count ?? 0,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (eventId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      
      // Update local storage first (for persistence in mock mode)
      const localFinished = JSON.parse(localStorage.getItem("recall_finished_events") || "[]");
      let updatedLocal;
      if (newStatus) {
        updatedLocal = [...new Set([...localFinished, eventId])];
      } else {
        updatedLocal = localFinished.filter((id: string) => id !== eventId);
      }
      localStorage.setItem("recall_finished_events", JSON.stringify(updatedLocal));

      // Optimistic UI update
      setEvents(prev => prev.map(ev =>
        ev.id === eventId ? { ...ev, is_completed: newStatus } : ev
      ));

      // Attempt DB update (may fail due to RLS in mock mode, but that's okay because we have the local fallback)
      const { error } = await supabase
        .from("events")
        .update({ is_completed: newStatus })
        .eq("id", eventId);

      if (error) {
        console.warn("DB Update blocked by RLS, but local persistence is active:", error.message);
      }
      
      toast.success(newStatus ? "Event marked as finished!" : "Event marked as active.");
    } catch (err: any) {
      console.error("TOGGLE EXCEPTION:", err);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up Realtime Subscriptions
    const channel = supabase
      .channel("dashboard-updates")
      .on("postgres_changes", { event: "*", scheme: "public", table: "events" }, () => fetchData())
      .on("postgres_changes", { event: "*", scheme: "public", table: "brain_knowledge" }, () => fetchData())
      .on("postgres_changes", { event: "*", scheme: "public", table: "brain_qa_history" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statCards = [
    { label: "Brain Items", value: stats.contexts, icon: FileText, color: "text-primary" },
    { label: "Pending Deadlines", value: stats.deadlines, icon: AlertCircle, color: "text-secondary" },
    { label: "Active This Week", value: stats.eventsThisWeek, icon: Calendar, color: "text-primary" },
    { label: "Total Knowledge", value: stats.recentEntries, icon: Clock, color: "text-secondary" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your AI-powered memory for important events and information.</p>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {statCards.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="gradient-subtle rounded-xl p-3">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{loading ? "–" : s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Upcoming & Today's Infromations</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">No upcoming events. Ingest some data to get started.</p>
          ) : (
            <motion.div className="space-y-3" variants={container} initial="hidden" animate="show">
              {events.map((ev) => (
                <motion.div
                  key={ev.id}
                  variants={item}
                  className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-all ${ev.is_completed ? "opacity-50 grayscale" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleComplete(ev.id, ev.is_completed || false)}
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${ev.is_completed ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 hover:border-emerald-500"}`}
                    >
                      {ev.is_completed && <CheckCircle className="h-3 w-3 text-white" />}
                    </button>
                    <Badge variant="secondary" className={typeColors[ev.event_type || ""] || "bg-muted text-muted-foreground"}>
                      {ev.event_type || "Event"}
                    </Badge>
                    <div className={ev.is_completed ? "line-through" : ""}>
                      <p className="font-medium text-sm">{ev.title}</p>
                      {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                      {ev.event_date && (
                        <p className="text-xs text-muted-foreground">{format(new Date(ev.event_date), "MMM d, yyyy")}</p>
                      )}
                    </div>
                  </div>
                  {ev.source && <Badge variant="outline" className="text-xs">{ev.source}</Badge>}
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
