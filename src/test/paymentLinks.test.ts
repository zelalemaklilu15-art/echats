import { describe,it,expect } from 'vitest';
import { paymentLink,parsePaymentPath } from '@/lib/paymentLinks';
describe('payment destination intents',()=>{
 it('round trips recipient, exact amount and note',()=>{const url=new URL(paymentLink('https://echats.lovable.app','@alice',10.01,'Lunch & tea'));expect(parsePaymentPath(url.pathname,url.search)).toEqual({recipient:'alice',amount:10.01,note:'Lunch & tea'});});
 it('request links encode only the authoritative request ID, not the payer',()=>{const id='00000000-0000-4000-8000-000000000031';const url=new URL(paymentLink('https://echats.lovable.app','payer',999,'tampered',id));expect(url.search).toBe('');expect(parsePaymentPath(url.pathname,url.search)).toEqual({requestId:id});});
 it('ignores tampered legacy amount and destination when a request ID exists',()=>{const id='00000000-0000-4000-8000-000000000031';expect(parsePaymentPath('/pay/@wrong',`?amount=999&ref=${id}`)).toEqual({requestId:id});});
 it('accepts legacy amount paths',()=>expect(parsePaymentPath('/pay/alice/15','?note=Lunch')).toEqual({recipient:'alice',amount:15,note:'Lunch'}));
 it.each(['0','-1','NaN','Infinity','100000.01','1.001'])('rejects invalid amount %s',amount=>expect(()=>parsePaymentPath('/pay/alice',`?amount=${amount}`)).toThrow());
});
