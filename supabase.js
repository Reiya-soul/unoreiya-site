const SUPABASE_URL = "https://etldfisflqtihcyzogra.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1xiWEEW1y2q9oFgTis9s5g__c2Gv4iF";

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
