import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { VOLCENGINE_DOMAIN, CODING_PLAN_URL, readCodingPlanUsage } from './utils.js';

export const codingUsageCommand = cli({
    site: 'volcengine',
    name: 'coding-usage',
    access: 'read',
    description: 'Read Volcengine Ark Coding Plan usage: 3-window used percentage (session/weekly/monthly) with reset time, plus subscription info. Percentages only, no absolute quota.',
    domain: VOLCENGINE_DOMAIN,
    strategy: Strategy.COOKIE,
    browser: true,
    siteSession: 'persistent',
    navigateBefore: true,
    args: [],
    columns: [
        'planType',
        'subscriptionStatus',
        'startTime',
        'endTime',
        'remainingDays',
        'billingMode',
        'autoRenew',
        'sessionPercent',
        'sessionResetTime',
        'weeklyPercent',
        'weeklyResetTime',
        'monthlyPercent',
        'monthlyResetTime',
        'apiStatus',
    ],
    func: async (page) => {
        await page.goto(CODING_PLAN_URL);
        const data = await readCodingPlanUsage(page);
        if (!data || (!data.subscription?.planType && !data.quotaUsage?.length)) {
            throw new CommandExecutionError('volcengine coding-usage returned malformed payload: no usage data');
        }
        const byLevel = {};
        for (const q of data.quotaUsage || []) {
            if (q.level) byLevel[q.level] = q;
        }
        return [{
            planType: data.subscription?.planType ?? null,
            subscriptionStatus: data.subscription?.status ?? null,
            startTime: data.subscription?.startTime ?? null,
            endTime: data.subscription?.endTime ?? null,
            remainingDays: data.subscription?.remainingDays ?? null,
            billingMode: data.subscription?.billingMode ?? null,
            autoRenew: data.subscription?.autoRenew,
            sessionPercent: byLevel.session?.percent ?? null,
            sessionResetTime: byLevel.session?.resetTime ?? null,
            weeklyPercent: byLevel.weekly?.percent ?? null,
            weeklyResetTime: byLevel.weekly?.resetTime ?? null,
            monthlyPercent: byLevel.monthly?.percent ?? null,
            monthlyResetTime: byLevel.monthly?.resetTime ?? null,
            apiStatus: data.status ?? null,
        }];
    },
});
