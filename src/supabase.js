import { createClient } from '@supabase/supabase-js';

// Projeto Supabase compartilhado por todas as empresas (multiempresa) — cada
// empresa só enxerga suas próprias linhas por causa das políticas de Row
// Level Security no banco (ver supabase/schema.sql), não por projetos
// separados como nos outros apps da pasta.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://SEU-PROJETO.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'SUA_ANON_KEY_AQUI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
