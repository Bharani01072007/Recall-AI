
-- Public read policies for all tables (no auth required for demo)
CREATE POLICY "Allow public read on events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow public read on documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public read on query_logs" ON public.query_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read on document_chunks" ON public.document_chunks FOR SELECT USING (true);

-- Allow public insert on query_logs for logging chat queries
CREATE POLICY "Allow public insert on query_logs" ON public.query_logs FOR INSERT WITH CHECK (true);
