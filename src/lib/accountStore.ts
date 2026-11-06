export interface Account {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  avatar?: string;
}

export class AccountStore {
  private static ACCOUNTS_KEY = 'user_accounts';
  private static ACTIVE_ACCOUNT_KEY = 'active_account';

  static getAccounts(): Account[] {
    const accounts = localStorage.getItem(this.ACCOUNTS_KEY);
    return accounts ? JSON.parse(accounts) : [];
  }

  static getActiveAccount(): Account | null {
    const activeId = localStorage.getItem(this.ACTIVE_ACCOUNT_KEY);
    if (!activeId) return null;
    
    const accounts = this.getAccounts();
    return accounts.find(account => account.id === activeId) || null;
  }

  static addAccount(name: string, phoneNumber: string): Account {
    const accounts = this.getAccounts();
    
    const newAccount: Account = {
      id: Date.now().toString(),
      name,
      phoneNumber,
      isActive: false
    };

    accounts.push(newAccount);
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
    
    return newAccount;
  }

  static switchAccount(accountId: string): void {
    const accounts = this.getAccounts();
    const updatedAccounts = accounts.map(account => ({
      ...account,
      isActive: account.id === accountId
    }));

    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    localStorage.setItem(this.ACTIVE_ACCOUNT_KEY, accountId);
  }

  static removeAccount(accountId: string): void {
    const accounts = this.getAccounts();
    const filteredAccounts = accounts.filter(account => account.id !== accountId);
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(filteredAccounts));

    // If removed account was active, clear active account
    const activeId = localStorage.getItem(this.ACTIVE_ACCOUNT_KEY);
    if (activeId === accountId) {
      localStorage.removeItem(this.ACTIVE_ACCOUNT_KEY);
    }
  }

  static initializeDefaultAccount(): void {
    const accounts = this.getAccounts();
    if (accounts.length === 0) {
      const defaultAccount = this.addAccount("የእኔ አካውንት", "");
      this.switchAccount(defaultAccount.id);
    }
  }
}