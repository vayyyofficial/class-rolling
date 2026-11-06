import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mhsxrfuyizcmdcfhmruu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_VsdBt4QmNKtPteLAhjXTlQ_YT7hov_z';

export default async function handler(req, res) {
  // Only allow GET / POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the idempotent PostgreSQL reroll function
    const { data, error } = await supabase.rpc('execute_seating_reroll', {
      p_roll_type: 'automatic',
      p_description: 'Rotasi Otomatis Mingguan Vercel Cron (Minggu 06:00 WIB)',
      p_admin_id: null,
    });

    if (error) {
      console.error('[Vercel Cron] Reroll RPC Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Weekly seating reroll executed successfully at Sunday 06:00 WIB',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Vercel Cron] Exception:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
