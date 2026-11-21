import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import rule from './require-disable-reason.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

tester.run('require-disable-reason', rule, {
  valid: [
    { code: '// eslint-disable-next-line no-console -- logging is the point here\nconsole.log(1);' },
    { code: '/* eslint-disable max-params -- mirrors the response fields */\nconst a = 1;' },
    { code: '// an ordinary comment\nconst a = 1;' },
    { code: '// eslint-disable-line no-console -- reason\nconsole.log(1);' },
  ],
  invalid: [
    { code: '// eslint-disable-next-line no-console\nconsole.log(1);', errors: [{ messageId: 'missing' }] },
    { code: '/* eslint-disable max-params */\nconst a = 1;', errors: [{ messageId: 'missing' }] },
    { code: '// eslint-disable-line no-console -- \nconsole.log(1);', errors: [{ messageId: 'missing' }] },
  ],
});
