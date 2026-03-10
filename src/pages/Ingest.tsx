import { useState, useRef, useEffect } from "react";
import { FileText, Upload, StickyNote, CheckCircle, Loader2, Search, Brain, Trash2, X, Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

const supabase = supabaseClient as any;

export default function Ingest() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Q&A State
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ content: string; similarity: number }[]>([]);
  
  // Knowledge Hub State
  const [storedDocs, setStoredDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Embedding model state (Gemini API)
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const fetchStoredDocs = async () => {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("brain_knowledge")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!error && data) setStoredDocs(data);
    setLoadingDocs(false);
  };

  useEffect(() => {
    fetchStoredDocs();
  }, []);

  const getEmbedding = async (content: string) => {
    if (!geminiKey) throw new Error("Missing Gemini API Key in .env");
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: content }] }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Gemini Embedding API failed");
    }

    const data = await response.json();
    return data.embedding.values;
  };

  const extractPdfText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const typedArray = new Uint8Array(reader.result as ArrayBuffer);
          // @ts-ignore - pdfjsLib is loaded via CDN in index.html
          const pdfjsLib = window['pdfjs-dist/build/pdf'];
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          let fullText = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
          }
          resolve(fullText);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const chunkText = (str: string, size: number) => {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  };

  const sendData = async () => {
    if (!text.trim()) return;
    if (!geminiKey) {
      toast.error("Missing Gemini API Key. Please add it to your .env file.");
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    
    try {
      // 1. Create Knowledge Entry
      const { data: doc, error: docError } = await supabase
        .from("brain_knowledge")
        .insert({
          name: file?.name || "Manual Entry",
          source_type: file ? file.type : "text/plain",
          metadata: { size: text.length, timestamp: new Date().toISOString() }
        })
        .select()
        .single();

      if (docError) throw docError;

      // 2. Create Knowledge Vectors with Embeddings
      const chunks = chunkText(text, 1000);
      toast.info(`Generating semantic signatures for ${chunks.length} chunks...`);
      
      const chunksData = [];
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await getEmbedding(chunks[i]);
        chunksData.push({
          knowledge_id: doc.id,
          content: chunks[i],
          embedding: JSON.stringify(embedding),
          metadata: { length: chunks[i].length }
        });
      }

      const { error: chunksError } = await supabase
        .from("brain_knowledge_vectors")
        .insert(chunksData);

      if (chunksError) throw chunksError;

      // 3. Create Event Entry for Dashboard
      await supabase.from("events").insert({
        title: `Ingested to Brain: ${file?.name || "Knowledge Note"}`,
        description: `Stored in dedicated knowledge tables and ready for instant recall.`,
        event_type: "Reminder",
        event_date: new Date().toISOString(),
        source: "RecallAI Brain",
        document_id: doc.id
      });

      setSuccess(true);
      setText("");
      setFile(null);
      toast.success("Knowledge successfully added to dedicated brain tables.");
      fetchStoredDocs();
    } catch (err: any) {
      console.error("INGESTION ERROR:", err);
      toast.error(`Ingestion Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKnowledgeQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!geminiKey) {
      toast.error("Missing Gemini API Key.");
      return;
    }

    setSearching(true);
    try {
      const embedding = await getEmbedding(query);
      
      const { data, error } = await supabase.rpc('match_brain_knowledge', {
        query_embedding: JSON.stringify(embedding),
        match_count: 3
      });

      if (error) throw error;
      setResults(data || []);
      
      if (data && data.length > 0) {
        // Save the Q&A to history
        const context = data.map((d: any) => d.content).join("\n---\n");
        await supabase.from("brain_qa_history").insert({
          question: query,
          answer: data[0].content, // For now, we save the top match as the answer
          context_used: context
        });
      } else {
        toast.info("No semantic matches found in brain memory.");
      }
    } catch (err: any) {
      console.error("QUERY ERROR:", err);
      toast.error(`Query failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);
    
    try {
      if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf")) {
        toast.info("Extracting text from PDF...");
        const extracted = await extractPdfText(selectedFile);
        setText(extracted);
        toast.success("PDF text extracted successfully!");
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setText(reader.result as string);
          toast.success("File content loaded.");
        };
        reader.readAsText(selectedFile);
      }
    } catch (err) {
      console.error("FILE LOAD ERROR:", err);
      toast.error("Failed to read file.");
    } finally {
      setLoading(false);
    }
  };

  const deleteDoc = async (id: string) => {
    try {
      // 1. Delete children from brain tables
      const { error: chunkError } = await supabase.from("brain_knowledge_vectors").delete().eq("knowledge_id", id);
      if (chunkError) throw chunkError;

      const { error: eventError } = await supabase.from("events").delete().eq("document_id", id);
      if (eventError) throw eventError;

      // 2. Delete main knowledge record
      const { error: docError } = await supabase.from("brain_knowledge").delete().eq("id", id);
      if (docError) throw docError;

      setStoredDocs(prev => prev.filter(d => d.id !== id));
      toast.success("Knowledge removed from brain tables.");
    } catch (err: any) {
      console.error("DELETE ERROR:", err);
      toast.error(`Deletion Failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Ingestion */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Upload className="h-6 w-6 text-primary" /> Feed Your Brain
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Upload documents to build your dedicated dedicated dedicated brain memory.</p>
          </div>

          <Card className="shadow-card border-primary/10">
            <CardContent className="pt-6">
              {!geminiKey && (
                <div className="mb-4 p-3 bg-destructive/5 rounded-lg flex items-center gap-3 text-xs text-destructive">
                  <X className="h-4 w-4" />
                  <span>Gemini API Key missing in .env. Search will not work.</span>
                </div>
              )}
              
              <Tabs defaultValue="paste">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="paste" className="gap-2"><FileText className="h-4 w-4" /> Paste</TabsTrigger>
                  <TabsTrigger value="upload" className="gap-2"><Upload className="h-4 w-4" /> File</TabsTrigger>
                  <TabsTrigger value="notes" className="gap-2"><StickyNote className="h-4 w-4" /> Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    placeholder="Paste context here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    className="resize-none bg-muted/30"
                  />
                </TabsContent>

                <TabsContent value="upload" className="mt-4">
                  <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3 bg-muted/10">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground italic">PDF, TXT, MD supported</p>
                    <input type="file" accept=".pdf,.txt,.md" onChange={handleFileUpload} className="hidden" id="file-upload" />
                    <Button variant="outline" size="sm" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">Choose File</label>
                    </Button>
                    {file && (
                      <p className="text-xs font-medium text-primary bg-primary/5 p-1 rounded inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {file.name}
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <Textarea
                    placeholder="Quick thoughts..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    className="resize-none bg-muted/30"
                  />
                </TabsContent>
              </Tabs>

              <div className="mt-4 flex items-center justify-between">
                <Button onClick={async () => { await sendData(); fetchStoredDocs(); }} disabled={loading || !text.trim() || !geminiKey} className="gradient-primary">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                  {loading ? "Indexing..." : "Store Semantically"}
                </Button>
                {success && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Indexed</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Local Q&A */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Search className="h-6 w-6 text-emerald-500" /> Direct Brain Query
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-card-foreground">Chat with your data directly via dedicated brain search.</p>
          </div>

          <Card className="shadow-card border-emerald-500/10 min-h-[400px] flex flex-col">
            <CardHeader className="pb-2">
              <form onSubmit={handleKnowledgeQuery} className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask your brain anything..."
                  className="flex-1 rounded-xl border bg-muted/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <Button type="submit" disabled={searching || !geminiKey || !query.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </form>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <AnimatePresence mode="wait">
                {results.length > 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                     <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Closest Semantic Matches</p>
                     {results.map((res, i) => (
                       <Card key={i} className="bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
                         <CardContent className="p-3 text-sm leading-relaxed">
                           <div className="flex justify-between items-start mb-1">
                             <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-500/20 text-emerald-700">
                               {Math.round(res.similarity * 100)}% Match
                             </Badge>
                           </div>
                           {res.content}
                         </CardContent>
                       </Card>
                     ))}
                  </motion.div>
                ) : searching ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 pt-12">
                     <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                     <p className="text-xs">Thinking...</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 pt-12 opacity-40">
                     <Brain className="h-12 w-12" />
                     <p className="text-center text-xs">Your semantic results will appear here.<br/>Ask a question to search your dedicated knowledge.</p>
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Hub: Knowledge Library */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" /> Stored Knowledge Bank
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchStoredDocs}>Refresh Library</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingDocs ? (
            <p className="text-xs text-muted-foreground col-span-full text-center py-8">Scanning brain memory...</p>
          ) : storedDocs.length === 0 ? (
             <div className="col-span-full p-12 border rounded-2xl border-dashed text-center opacity-50">
               <p className="text-sm">No knowledge stored in dedicated tables yet.</p>
             </div>
          ) : (
            storedDocs.map((doc) => (
              <Card key={doc.id} className="shadow-none border-muted/50 hover:border-primary/20 transition-colors group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-primary/5 rounded-lg">
                       <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground">Stored {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteDoc(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
