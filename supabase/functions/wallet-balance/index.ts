import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access wallet data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Wallet fetch error:', walletError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!wallet) {
      return new Response(
        JSON.stringify({ 
          wallet: null,
          transactions: [],
          stats: { monthly_received: 0, monthly_sent: 0 },
          needs_activation: true,
          message: 'Wallet not found. Please activate your wallet.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get balance from ledger
    const balance = wallet.balance;

    // Get recent transactions
    const { data: transactions } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate monthly stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyRows: { amount: number; type: string; created_at: string }[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data: rows, error: statsError } = await supabaseAdmin.from('wallet_transactions')
        .select('amount,type,created_at').eq('wallet_id', wallet.id).eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString()).order('id').range(offset, offset + 99);
      if (statsError) throw statsError;
      monthlyRows.push(...(rows ?? []));
      if ((rows?.length ?? 0) < 100) break;
    }
    const monthlyReceived = monthlyRows
      .filter(t => 
        new Date(t.created_at) >= startOfMonth && 
        (t.type === 'deposit' || t.type === 'transfer_in')
      )
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlySent = monthlyRows
      .filter(t => 
        new Date(t.created_at) >= startOfMonth && 
        t.type === 'transfer_out'
      )
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return new Response(
      JSON.stringify({ 
        wallet: {
          id: wallet.id,
          status: wallet.status,
          currency: wallet.currency,
          balance: parseFloat(balance) || 0,
          terms_accepted_at: wallet.terms_accepted_at,
          created_at: wallet.created_at,
        },
        transactions: transactions || [],
        stats: {
          monthly_received: monthlyReceived,
          monthly_sent: monthlySent,
        },
        needs_activation: wallet.status !== 'active',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Balance fetch error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
