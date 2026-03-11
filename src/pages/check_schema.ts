import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ijrkqrrbjnulcmphmdco.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcmtxcnJiam51bGNtcGhtZGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTk0MjAsImV4cCI6MjA4ODU5NTQyMH0.bujC-2eI1xVuaT6e6qE6H9XEz7W9XHfEomKetFk3s1I"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching event:', error)
  } else if (data && data.length > 0) {
    console.log('Columns in events table:', Object.keys(data[0]))
  } else {
    console.log('No events found to check columns.')
  }
}

checkSchema()
