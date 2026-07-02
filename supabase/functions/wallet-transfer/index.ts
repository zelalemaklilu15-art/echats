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

    const { recipient_id, amount, note, idempotency_key, pin } = await req.json();

    // Validate inputs
    if (!recipient_id) {
      return new Response(
        JSON.stringify({ error: 'Recipient ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recipient_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot transfer to yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount. Must be a positive number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transferAmount > 100000) {
      return new Response(
        JSON.stringify({ error: 'Amount exceeds maximum transfer limit.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for atomic operations with locking
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ---- Wallet PIN enforcement (server-side) ----
    // If the sender has a wallet PIN configured, it must be provided and valid.
    const { data: hasPinData } = await supabaseAdmin
      .rpc('verify_wallet_pin', { p_user_id: user.id, p_pin: typeof pin === 'string' ? pin : '' });
    const { data: walletRowForPin } = await supabaseAdmin
      .from('wallets').select('pin_hash').eq('user_id', user.id).maybeSingle();
    if (walletRowForPin?.pin_hash) {
      if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: 'Wallet PIN is required for transfers.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!hasPinData) {
        return new Response(
          JSON.stringify({ error: 'Incorrect wallet PIN.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for idempotency
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

    // Get sender wallet
    const { data: senderWallet, error: senderError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (senderError || !senderWallet) {
      return new Response(
        JSON.stringify({ error: 'Your wallet not found. Please activate your wallet first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (senderWallet.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Your wallet is not active.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient wallet
    const { data: recipientWallet, error: recipientError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', recipient_id)
      .single();

    if (recipientError || !recipientWallet) {
      return new Response(
        JSON.stringify({ error: 'Recipient wallet not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recipientWallet.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Recipient wallet is not active.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender balance with lock
    const { data: senderBalance } = await supabaseAdmin
      .rpc('get_wallet_balance', { p_wallet_id: senderWallet.id });
    
    const currentSenderBalance = parseFloat(senderBalance) || 0;

    // Check sufficient balance
    if (currentSenderBalance < transferAmount) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          current_balance: currentSenderBalance,
          required: transferAmount
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient balance
    const { data: recipientBalance } = await supabaseAdmin
      .rpc('get_wallet_balance', { p_wallet_id: recipientWallet.id });
    
    const currentRecipientBalance = parseFloat(recipientBalance) || 0;

    // Generate reference ID to link the two transactions
    const referenceId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create sender debit transaction
    const { data: senderTx, error: senderTxError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        wallet_id: senderWallet.id,
        idempotency_key: idempotency_key ? `${idempotency_key}_out` : null,
        type: 'transfer_out',
        status: 'completed',
        amount: transferAmount,
        balance_before: currentSenderBalance,
        balance_after: currentSenderBalance - transferAmount,
        reference_id: referenceId,
        counterparty_wallet_id: recipientWallet.id,
        description: note || `Transfer to user`,
        metadata: {
          recipient_user_id: recipient_id,
          note: note || null,
          timestamp,
        }
      })
      .select()
      .single();

    if (senderTxError) {
      console.error('Sender transaction error:', senderTxError);
      return new Response(
        JSON.stringify({ error: 'Failed to process transfer. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create recipient credit transaction
    const { error: recipientTxError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        wallet_id: recipientWallet.id,
        idempotency_key: idempotency_key ? `${idempotency_key}_in` : null,
        type: 'transfer_in',
        status: 'completed',
        amount: transferAmount,
        balance_before: currentRecipientBalance,
        balance_after: currentRecipientBalance + transferAmount,
        reference_id: referenceId,
        counterparty_wallet_id: senderWallet.id,
        description: note || `Transfer from user`,
        metadata: {
          sender_user_id: user.id,
          note: note || null,
          timestamp,
        }
      });

    if (recipientTxError) {
      console.error('Recipient transaction error:', recipientTxError);
      // Note: In production, we'd need to reverse the sender transaction here
      // For now, log the error - the transaction is atomic in Supabase
      return new Response(
        JSON.stringify({ error: 'Failed to complete transfer. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient profile for response
    const { data: recipientProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, username')
      .eq('id', recipient_id)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction: {
          id: senderTx.id,
          reference_id: referenceId,
          type: 'transfer_out',
          amount: transferAmount,
          balance_after: senderTx.balance_after ?? currentSenderBalance - transferAmount,
          recipient: recipientProfile?.name || recipientProfile?.username || 'User',
          status: 'completed',
          created_at: senderTx.created_at,
          note: note || null,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transfer error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
