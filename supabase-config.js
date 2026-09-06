const SUPABASE_URL = "https://doaxutmidxxaxyicviaq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__ZMtYANYKaE8xbngc2z86A_buCqsXhN";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);