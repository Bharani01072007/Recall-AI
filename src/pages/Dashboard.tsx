import { useEffect, useState } from "react";
import { Calendar, Clock, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  event_date: string | null;
  source: string | null;
}

const typeColors: Record<string, string> = {
  Meeting: "bg-primary/10 text-primary",
  Deadline: "bg-destructive/10 text-destructive",
  Reminder: "bg-secondary/10 text-secondary",
  Announcement: "bg-accent text-accent-foreground",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
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

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        const endOfWeekIso = endOfWeek.toISOString();

        const [eventsRes, docsRes, logsRes, totalEventsRes, deadlinesRes, weekEventsRes] = await Promise.all([
          supabase.from("events").select("*").order("event_date", { ascending: false }).limit(10),
          supabase.from("documents").select("id", { count: "exact", head: true }),
          supabase.from("query_logs").select("id", { count: "exact", head: true }),
          supabase.from("events").select("id", { count: "exact", head: true }),
          supabase.from("events").select("id", { count: "exact", head: true }).eq("event_type", "Deadline"),
          supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", startOfDay).lte("event_date", endOfWeekIso),
        ]);

        if (eventsRes.error) throw eventsRes.error;

        setEvents((eventsRes.data as Event[]) || []);

        setStats({
          contexts: (docsRes.count ?? 0) + (logsRes.count ?? 0),
          deadlines: deadlinesRes.count ?? 0,
          eventsThisWeek: weekEventsRes.count ?? 0,
          recentEntries: totalEventsRes.count ?? 0,
        });
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const statCards = [
    { label: "Stored Contexts", value: stats.contexts, icon: FileText, color: "text-primary" },
    { label: "Upcoming Deadlines", value: stats.deadlines, icon: AlertCircle, color: "text-secondary" },
    { label: "Events This Week", value: stats.eventsThisWeek, icon: Calendar, color: "text-primary" },
    { label: "Recent Entries", value: stats.recentEntries, icon: Clock, color: "text-secondary" },
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
          <CardTitle className="font-display">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">No events yet. Ingest some data to get started.</p>
          ) : (
            <motion.div className="space-y-3" variants={container} initial="hidden" animate="show">
              {events.map((ev) => (
                <motion.div
                  key={ev.id}
                  variants={item}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={typeColors[ev.event_type || ""] || "bg-muted text-muted-foreground"}>
                      {ev.event_type || "Event"}
                    </Badge>
                    <div>
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
