// 環境に応じてローカルまたは本番のSupabaseを使用
let SUPABASE_URL = 'https://xvskgttdsjeidfzmcxhi.supabase.co';
let SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2c2tndHRkc2plaWRmem1jeGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4Mzc3OTMsImV4cCI6MjA2NjQxMzc5M30.5csbLUDGuQQ5qvyChIQSBGI16KjytJfh4DmWjoEydIw';

// ローカル開発環境の場合、ローカルのSupabaseを使用
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    SUPABASE_URL = 'http://localhost:54321';
    SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);