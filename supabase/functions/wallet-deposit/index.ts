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

    const { amount, method, idempotency_key } = await req.json();

    // Validate amount
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount. Must be a positive number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (depositAmount > 1000000) {
      return new Response(
        JSON.stringify({ error: 'Amount exceeds maximum deposit limit.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate method - must be a recognized payment method
    const validMethods = [
      'Credit/Debit Card', 'Bank Transfer', 'Mobile Money',
      'Telebirr', 'CBEBirr', 'Awash Bank', 'Dashen Bank',
    ];
    const methodName = typeof method === 'string' ? method.trim() : '';
    if (!validMethods.includes(methodName)) {
      return new Response(
        JSON.stringify({ error: `Invalid payment method: ${methodName || '(empty)'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for atomic operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get wallet with row lock
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found. Please activate your wallet first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (wallet.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Wallet is not active. Please accept terms to activate.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for idempotency (prevent duplicate transactions)
    if (idempotency_key) {
      const { data: existingTx } = await supabaseAdmin
        .from('wallet_transactions')
        .select('*')
        .eq('idempotency_key', idempotency_key)
        .single();

      if (existingTx) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Transaction already processed',
            transaction: existingTx,
            duplicate: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Rate limiting: max 5 deposits per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentDeposits } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_id', wallet.id)
      .eq('type', 'deposit')
      .gte('created_at', oneHourAgo);

    if ((recentDeposits || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: 'Too many deposit attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Daily deposit limit: max 50,000 ETB per day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: dailyDeposits } = await supabaseAdmin
      .from('wallet_transactions')
      .select('amount')
      .eq('wallet_id', wallet.id)
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString());

    const dailyTotal = (dailyDeposits || []).reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    if (dailyTotal + depositAmount > 50000) {
      return new Response(
        JSON.stringify({ error: `Daily deposit limit exceeded. You can deposit up to ${(50000 - dailyTotal).toFixed(2)} ETB today.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Per-transaction limit
    if (depositAmount > 10000) {
      return new Response(
        JSON.stringify({ error: 'Single deposit cannot exceed 10,000 ETB. Please deposit a smaller amount.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current balance
    const { data: balanceResult } = await supabaseAdmin
      .rpc('get_wallet_balance', { p_wallet_id: wallet.id });
    
    const currentBalance = parseFloat(balanceResult) || 0;
    const newBalance = currentBalance + depositAmount;

    // Create transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        idempotency_key: idempotency_key || null,
        type: 'deposit',
        status: 'completed',
        amount: depositAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Added money via ${methodName}`,
        metadata: {
          method: methodName,
          timestamp: new Date().toISOString(),
          user_agent: req.headers.get('user-agent'),
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction error:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to process deposit. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction: {
          id: transaction.id,
          type: 'deposit',
          amount: depositAmount,
          balance_after: transaction.balance_after ?? newBalance,
          method: methodName,
          status: 'completed',
          created_at: transaction.created_at,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Deposit error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
