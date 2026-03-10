import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const sampleQueries = [
  "Show upcoming meetings",
  "Any deadlines this week?",
  "What important events are stored?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => "session-" + Math.random().toString(36).substring(2, 9));
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const searchLocalContext = async (query: string) => {
    if (!geminiKey) return "";
    try {
      // 1. Get query embedding from Gemini
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: query }] }
        })
      });

      if (!response.ok) return "";
      const embedData = await response.json();
      const embedding = embedData.embedding.values;

      // 2. Search Supabase using vector match
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: JSON.stringify(embedding),
        match_count: 5
      });

      if (error || !data || data.length === 0) return "";
      
      const contextText = data.map((c: any) => c.content).join("\n\n---\n\n");
      return `CONTEXT FROM DATABASE (Semantically Matched):\n${contextText}\n\nUSER QUESTION:`;
    } catch (e) {
      console.error("Semantic search error:", e);
      return "";
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const webhookUrl = import.meta.env.VITE_N8N_QUERY_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error("Missing VITE_N8N_QUERY_WEBHOOK_URL in environment variables.");
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ 
          question: text,
          sessionId: sessionId
        }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const responseText = await res.text();
      
      let answer = "";
      if (!responseText || responseText.trim() === "") {
        answer = "The server returned an empty response. Please ensure your n8n workflow is Active and returning data.";
      } else {
        try {
          const data = JSON.parse(responseText);
          answer = typeof data === "string" ? data : (data.response || data.message || data.output || data.text || data.answer || JSON.stringify(data));
        } catch (e) {
          answer = responseText;
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, there was an error connecting to the n8n backend. Please check if the webhook is active and the URL is correctly configured in `.env`.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-6 border-b bg-card">
        <h1 className="text-2xl font-display font-bold">Ask RecallAI</h1>
        <p className="text-sm text-muted-foreground">Query your stored information using natural language.</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-6"
          >
            <div className="gradient-primary rounded-2xl p-4">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-display font-semibold">What can I help you recall?</h2>
              <p className="text-muted-foreground text-sm mt-1">Try one of these sample queries:</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {sampleQueries.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  className="rounded-full"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="gradient-primary rounded-lg p-2 h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <Card
                className={`max-w-[75%] p-4 ${
                  msg.role === "user"
                    ? "gradient-primary text-primary-foreground"
                    : "bg-card shadow-card"
                }`}
              >
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </Card>
              {msg.role === "user" && (
                <div className="rounded-lg bg-muted p-2 h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="gradient-primary rounded-lg p-2 h-8 w-8 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <Card className="p-4 shadow-card">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.15s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.3s]" />
              </div>
            </Card>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask RecallAI anything..."
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={loading || !input.trim()} className="rounded-xl px-4 gradient-primary">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
