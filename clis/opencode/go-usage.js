import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { OPENCODE_DOMAIN, DEFAULT_WORKSPACE, goUrl, billingUrl, readGoUsage, readBilling } from './utils.js';

export const goUsageCommand = cli({
    site: 'opencode',
    name: 'go-usage',
    access: 'read',
    description: 'Read OpenCode Go usage: rolling/weekly/monthly percentage with reset time, plus Zen balance and last payment from billing. No derived dollar estimate on usage rows.',
    domain: OPENCODE_DOMAIN,
    strategy: Strategy.COOKIE,
    browser: true,
    siteSession: 'persistent',
    navigateBefore: true,
    args: [
        { name: 'workspace', required: false, help: 'OpenCode workspace id (default: known workspace)', default: DEFAULT_WORKSPACE },
    ],
    columns: ['Section', 'Percent', 'ResetsIn', 'Amount', 'Detail'],
    func: async (page, kwargs) => {
        const ws = kwargs.workspace;
        await page.goto(goUrl(ws));
        const go = await readGoUsage(page);
        await page.goto(billingUrl(ws));
        const billing = await readBilling(page);

        const rows = [];
        if (go.rolling) {
            rows.push({ Section: '滚动用量', Percent: go.rolling.percent, ResetsIn: go.rolling.resetsIn, Amount: null, Detail: go.subscribed });
        }
        if (go.weekly) {
            rows.push({ Section: '每周用量', Percent: go.weekly.percent, ResetsIn: go.weekly.resetsIn, Amount: null, Detail: go.subscribed });
        }
        if (go.monthly) {
            rows.push({ Section: '每月用量', Percent: go.monthly.percent, ResetsIn: go.monthly.resetsIn, Amount: null, Detail: go.subscribed });
        }
        if (billing.zenBalance) {
            rows.push({
                Section: 'Zen Balance',
                Percent: null,
                ResetsIn: null,
                Amount: billing.zenBalance,
                Detail: `自动充值 ${billing.autoTopup ?? 'unknown'} | 每月限额 ${billing.monthlyLimit ?? 'unknown'}`,
            });
        }
        if (billing.lastPayment) {
            rows.push({
                Section: 'Last Payment',
                Percent: null,
                ResetsIn: null,
                Amount: billing.lastPayment.amount,
                Detail: `${billing.lastPayment.date} | card **${billing.cardLast4 ?? '????'}`,
            });
        }
        if (rows.length === 0) {
            throw new CommandExecutionError('opencode go-usage returned malformed payload: no usage data');
        }
        return rows;
    },
});
