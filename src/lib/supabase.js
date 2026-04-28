import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tsvymvbxyyfzkyeylfka.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdnltdmJ4eXlmemt5ZXlsZmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTQwNjUsImV4cCI6MjA5MjYzMDA2NX0.nldqcmmLjV_3GmleVhuyugYVnEN8FU__lNRmYVn6vnw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
