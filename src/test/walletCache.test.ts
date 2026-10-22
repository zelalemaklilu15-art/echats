import { describe, it, expect, vi, beforeEach } from 'vitest';
const auth=vi.hoisted(()=>({user:'A' as string|null,listener:null as any,invoke:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:async()=>({data:{session:auth.user?{access_token:'test',user:{id:auth.user}}:null}}),onAuthStateChange:(fn:any)=>{auth.listener=fn;return {data:{subscription:{unsubscribe(){}}}};}},functions:{invoke:auth.invoke}}}));
vi.mock('@/lib/walletSecurity',()=>({getDeviceId:async()=> 'device-test'}));
import { walletService } from '@/lib/walletService';
const data=(balance=120)=>({wallet:{id:'wallet-A',balance,status:'active'},transactions:[{id:'tx-A',amount:50,created_at:new Date().toISOString(),type:'transfer_out'}],needs_activation:false,stats:{monthly_sent:50,monthly_received:0}});
beforeEach(()=>{auth.user='A';walletService.invalidateCache();auth.invoke.mockReset();auth.invoke.mockResolvedValue({data:data(),error:null});});
describe('wallet account cache',()=>{
 it('authenticates before returning a warm cache',async()=>{await walletService.getWalletBalance();auth.user=null;await expect(walletService.getWalletBalance()).rejects.toThrow('Not authenticated');expect(walletService.getCachedTransactions()).toEqual([]);expect(walletService.getCachedBalance()).toBe(0);});
 it('clears financial data immediately on account change',async()=>{await walletService.getWalletBalance();auth.listener('SIGNED_IN',{user:{id:'B'}});expect(walletService.getCachedWallet()).toBeNull();expect(walletService.getCachedTransactions()).toEqual([]);});
 it('rejects an old account response arriving after switching',async()=>{let resolve:any;auth.invoke.mockImplementation(()=>new Promise(r=>{resolve=r;}));const pending=walletService.getWalletBalance();await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));auth.listener('SIGNED_IN',{user:{id:'B'}});resolve({data:data(),error:null});await expect(pending).rejects.toThrow('Account changed');expect(walletService.getCachedBalance()).toBe(0);});
 it('cannot fabricate wallet deductions from a local goal or schedule',async()=>{await walletService.getWalletBalance();walletService.deductLocalBalance(20);expect(walletService.getCachedWallet()).toBeNull();auth.invoke.mockResolvedValue({data:data(),error:null});expect((await walletService.getWalletBalance()).wallet?.balance).toBe(120);});
});
