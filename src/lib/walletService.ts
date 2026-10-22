// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/walletSecurity";

export interface WalletData {
  id: string;
  status: 'active' | 'suspended' | 'pending_activation';
  currency: string;
  balance: number;
  terms_accepted_at: string | null;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'payment' | 'refund' | 'bonus' | 'fee';
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'reversed';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  counterparty_wallet_id: string | null;
  reference_id: string | null;
}

export interface WalletBalanceResponse {
  wallet: WalletData | null;
  transactions: WalletTransaction[];
  stats: {
    monthly_received: number;
    monthly_sent: number;
  };
  needs_activation: boolean;
}

export interface TransferResult {
  success: boolean;
  transaction?: {
    id: string;
    reference_id: string;
    type: string;
    amount: number;
    balance_after: number;
    recipient: string;
    status: string;
    created_at: string;
    note: string | null;
  };
  error?: string;
  duplicate?: boolean;
}

export interface DepositResult {
  success: boolean;
  transaction?: {
    id: string;
    type: string;
    amount: number;
    balance_after: number;
    method: string;
    status: string;
    created_at: string;
  };
  error?: string;
  duplicate?: boolean;
}

class WalletService {
  private static instance: WalletService;
  private cachedWallet: WalletData | null = null;
  private cachedTransactions: WalletTransaction[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private viewer: string | null = null;
  private generation = 0;
  private cachedStats = { monthly_received: 0, monthly_sent: 0 };

  private constructor() {
    supabase.auth.onAuthStateChange((_event, session) => this.setViewer(session?.user.id ?? null));
  }

  private setViewer(id: string | null) {
    if (id === this.viewer) return;
    this.viewer = id;
    this.generation += 1;
    this.invalidateCache();
  }

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    this.setViewer(session?.user.id ?? null);
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return session.access_token;
  }

  public async getWalletBalance(forceRefresh = false): Promise<WalletBalanceResponse> {
    const token = await this.getAuthToken();
    const generation = this.generation;
    const now = Date.now();
    
    // Return cached data if still valid
    if (!forceRefresh && this.cachedWallet && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return {
        wallet: this.cachedWallet,
        transactions: this.cachedTransactions,
        stats: this.cachedStats,
        needs_activation: this.cachedWallet.status !== 'active',
      };
    }

    const response = await supabase.functions.invoke('wallet-balance', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to fetch wallet balance');
    }

    const data = response.data as WalletBalanceResponse;
    if (generation !== this.generation) throw new Error('Account changed. Please retry.');
    
    // Cache the results
    this.cachedWallet = data.wallet ?? null;
    this.cachedTransactions = data.transactions ?? [];
    this.cachedStats = data.stats ?? { monthly_received: 0, monthly_sent: 0 };
    this.lastFetchTime = now;

    return data;
  }

  public async activateWallet(_deviceHash?: string): Promise<{ success: boolean; wallet?: WalletData; error?: string }> {
    const token = await this.getAuthToken();
    
    const response = await supabase.functions.invoke('wallet-activate', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        device_id: await getDeviceId(),
        user_agent: navigator.userAgent,
      },
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    const data = response.data;
    
    this.invalidateCache();
    return { success: !!data.success, wallet: data.wallet, error: data.error };
  }

  public async deposit(
    amount: number, 
    method: string,
    idempotencyKey?: string
  ): Promise<DepositResult> {
    const token = await this.getAuthToken();
    
    const response = await supabase.functions.invoke('wallet-deposit', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        amount,
        method,
        device_id: await getDeviceId(),
        idempotency_key: idempotencyKey || this.generateIdempotencyKey(),
      },
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    this.invalidateCache();
    return response.data as DepositResult;
  }

  public async transfer(
    recipientId: string,
    amount: number,
    note?: string,
    idempotencyKey?: string,
    pin?: string,
    paymentRequestId?: string
  ): Promise<TransferResult> {
    const token = await this.getAuthToken();
    
    const response = await supabase.functions.invoke('wallet-transfer', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        recipient_id: recipientId,
        amount,
        note,
        pin,
        device_id: await getDeviceId(),
        payment_request_id: paymentRequestId,
        idempotency_key: idempotencyKey || this.generateIdempotencyKey(),
      },
    });

    if (response.error) {
      let msg = response.error.message;
      try { const body = await (response.error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
      return { success: false, error: msg };
    }

    this.invalidateCache();
    return response.data as TransferResult;
  }

  public getCachedBalance(): number {
    return this.cachedWallet?.balance ?? 0;
  }

  public deductLocalBalance(amount: number): void {
    // Financial balances may only change through committed server ledger entries.
    this.invalidateCache();
  }

  public getCachedWallet(): WalletData | null {
    return this.cachedWallet;
  }

  public getCachedTransactions(): WalletTransaction[] {
    return this.cachedTransactions;
  }

  public invalidateCache(): void {
    this.lastFetchTime = 0;
    this.cachedWallet = null;
    this.cachedTransactions = [];
  }

  public async getTransaction(id: string): Promise<WalletTransaction | null> {
    await this.getAuthToken();
    const generation = this.generation;
    const { data, error } = await supabase.from('wallet_transactions').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (generation !== this.generation) throw new Error('Account changed');
    return data as WalletTransaction | null;
  }

  public async getTransactionHistory(): Promise<WalletTransaction[]> {
    await this.getAuthToken();
    const generation = this.generation;
    const rows: WalletTransaction[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.from('wallet_transactions').select('*')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99);
      if (error) throw error;
      if (generation !== this.generation) throw new Error('Account changed');
      rows.push(...(data ?? []) as WalletTransaction[]);
      if ((data?.length ?? 0) < 100) return rows;
    }
  }

  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

}

export const walletService = WalletService.getInstance();
