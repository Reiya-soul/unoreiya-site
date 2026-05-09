import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://etldfisflqtihcyzogra.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1xiWEEW1y2q9oFgTis9s5g__c2Gv4iF";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);