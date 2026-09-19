import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordStrength,passwordField} from '../src/portal/passwords.js';

test('password strength is conservative for common, repeated and sequential inputs',()=>{
 assert.equal(passwordStrength(''),0);
 for(const value of ['short','12345678','١٢٣٤٥٦٧٨','abcdefgh','Password1!','P@ssw0rd2026!','welcome2026!!','aaaaaaaaaaaaaaaa','Abcdefgh12345678!','T7!qT7!qT7!qT7!q','Abc12Abc12Abc12Abc12','Test1!Test1!Test1!','كلمة المرور ١٢٣٤٥٦٧٨'])assert.equal(passwordStrength(value),1,value);
 assert.equal(passwordStrength('T7!qR2@v'),2);
 assert.equal(passwordStrength('J7@rV2!qK9#m'),3);
 assert.equal(passwordStrength('purple-cactus-river-moon'),4);
 assert.equal(passwordStrength('قمر-بنفسجي-نهر-شجرة'),4);
 assert.equal(passwordStrength('J7@rV2!qK9#mD4&s'),4);
});

test('new-password hints are localized and not attached to existing passwords',()=>{
 const signup=passwordField('password','Password','new-password','en');
 assert.match(signup,/minlength="8"/);assert.match(signup,/data-password-strength="password"/);assert.match(signup,/aria-valuemin="0" aria-valuemax="4"/);
 assert.match(signup,/data-eye-slash hidden/);assert.match(signup,/aria-controls="password-password"/);
 assert.match(passwordField('password','كلمة المرور','new-password','ar'),/قوة كلمة المرور/);
 const login=passwordField('password','Password','current-password','en');
 assert.doesNotMatch(login,/minlength|maxlength|data-password-strength/);
 const confirm=passwordField('confirm','Confirm password','new-password','en');
 assert.match(confirm,/minlength="8"/);assert.doesNotMatch(confirm,/data-password-strength/);
});
