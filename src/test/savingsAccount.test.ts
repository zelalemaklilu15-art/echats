import {beforeEach,describe,it,expect} from 'vitest';
import {getGoals,createGoal,deleteGoal,addFundsToGoal} from '@/lib/savingsGoalService';
beforeEach(()=>localStorage.clear());
describe('local goal account boundaries',()=>{
 it('does not expose another account or claim unknown legacy goals',()=>{localStorage.setItem('echat_savings_goals',JSON.stringify([{name:'Legacy private'}]));createGoal('A','Home','🏠',1000);expect(getGoals('B')).toEqual([]);expect(getGoals('')).toEqual([]);expect(getGoals('A')).toHaveLength(1);});
 it('cannot delete another account goal',()=>{const g=createGoal('A','Home','🏠',1000);deleteGoal('B',g.id);expect(getGoals('A')[0].id).toBe(g.id);});
 it('cannot fabricate saved money',()=>{const g=createGoal('A','Home','🏠',1000);expect(()=>addFundsToGoal(g.id,100)).toThrow('No money has been moved');expect(getGoals('A')[0].currentAmount).toBe(0);});
});
