const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = "https://ijrkqrrbjnulcmphmdco.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcmtxcnJiam51bGNtcGhtZGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTk0MjAsImV4cCI6MjA4ODU5NTQyMH0.bujC-2eI1xVuaT6e6qE6H9XEz7W9XHfEomKetFk3s1I"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  const { data, error } = await supabase
    .from('brain_knowledge_vectors')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error)
  } else if (data && data.length > 0) {
    const keys = Object.keys(data[0]);
    console.log('---COLUMNS_START---');
    keys.forEach(k => console.log(k));
    console.log('---COLUMNS_END---');
  } else {
    console.log('No vectors found.')
  }
}

checkSchema()
