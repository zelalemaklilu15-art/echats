// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

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

  private constructor() {}

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return session.access_token;
  }

  public async getWalletBalance(forceRefresh = false): Promise<WalletBalanceResponse> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (!forceRefresh && this.cachedWallet && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return {
        wallet: this.cachedWallet,
        transactions: this.cachedTransactions,
        stats: this.calculateStats(this.cachedTransactions),
        needs_activation: this.cachedWallet.status !== 'active',
      };
    }

    const token = await this.getAuthToken();
    
    const response = await supabase.functions.invoke('wallet-balance', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to fetch wallet balance');
    }

    const data = response.data as WalletBalanceResponse;
    
    // Cache the results
    if (data.wallet) {
      this.cachedWallet = data.wallet;
      this.cachedTransactions = data.transactions;
      this.lastFetchTime = now;
    }

    return data;
  }

  private calculateStats(transactions: WalletTransaction[]): { monthly_received: number; monthly_sent: number } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyReceived = transactions
      .filter(t => 
        new Date(t.created_at) >= startOfMonth && 
        (t.type === 'deposit' || t.type === 'transfer_in')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlySent = transactions
      .filter(t => 
        new Date(t.created_at) >= startOfMonth && 
        t.type === 'transfer_out'
      )
      .reduce((sum, t) => sum + t.amount, 0);

    return { monthly_received: monthlyReceived, monthly_sent: monthlySent };
  }

  public async activateWallet(deviceHash?: string): Promise<{ success: boolean; wallet?: WalletData; error?: string }> {
    const token = await this.getAuthToken();
    
    const response = await supabase.functions.invoke('wallet-activate', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        device_hash: deviceHash || this.generateDeviceHash(),
        user_agent: navigator.userAgent,
      },
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    const data = response.data;
    
    if (data.wallet) {
      this.cachedWallet = data.wallet;
      this.lastFetchTime = Date.now();
    }

    this.invalidateCache();
    return { success: true, wallet: data.wallet };
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
    pin?: string
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
    if (this.cachedWallet) {
      this.cachedWallet = { ...this.cachedWallet, balance: Math.max(0, this.cachedWallet.balance - amount) };
    }
  }

  public getCachedWallet(): WalletData | null {
    return this.cachedWallet;
  }

  public getCachedTransactions(): WalletTransaction[] {
    return this.cachedTransactions;
  }

  public invalidateCache(): void {
    this.lastFetchTime = 0;
  }

  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateDeviceHash(): string {
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export const walletService = WalletService.getInstance();
