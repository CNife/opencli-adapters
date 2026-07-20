import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { VOLCENGINE_DOMAIN, AGENT_PLAN_URL, readAgentPlanUsage } from './utils.js';

export const agentUsageCommand = cli({
    site: 'volcengine',
    name: 'agent-usage',
    access: 'read',
    description: 'Read Volcengine Ark Agent Plan usage: 4-window AFP absolute Quota/Used (5h/daily/weekly/monthly) with reset time, current-tier RPM/TPM/token limits, and subscription info.',
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
        'afpFiveHourQuota',
        'afpFiveHourUsed',
        'afpFiveHourResetTime',
        'afpDailyQuota',
        'afpDailyUsed',
        'afpDailyResetTime',
        'afpWeeklyQuota',
        'afpWeeklyUsed',
        'afpWeeklyResetTime',
        'afpMonthlyQuota',
        'afpMonthlyUsed',
        'afpMonthlyResetTime',
        'rpm',
        'tpm',
        'token5hLimit',
        'tokenDailyLimit',
        'tokenWeeklyLimit',
        'tokenMonthlyLimit',
    ],
    func: async (page) => {
        await page.goto(AGENT_PLAN_URL);
        const data = await readAgentPlanUsage(page);
        if (!data || (!data.subscription?.planType && !data.afp?.afp)) {
            throw new CommandExecutionError('volcengine agent-usage returned malformed payload: no usage data');
        }
        const afp = data.afp?.afp || {};
        const limit = data.quotaLimit;
        const tokenWindows = {};
        for (const w of limit?.TokenWindowLimits || []) {
            if (w.DurationSeconds) tokenWindows[w.DurationSeconds] = w.Token;
        }
        return [{
            planType: data.subscription?.planType ?? null,
            subscriptionStatus: data.subscription?.status ?? null,
            startTime: data.subscription?.startTime ?? null,
            endTime: data.subscription?.endTime ?? null,
            remainingDays: data.subscription?.remainingDays ?? null,
            billingMode: data.subscription?.billingMode ?? null,
            autoRenew: data.subscription?.autoRenew,
            afpFiveHourQuota: afp.fiveHour?.quota ?? null,
            afpFiveHourUsed: afp.fiveHour?.used ?? null,
            afpFiveHourResetTime: afp.fiveHour?.resetTime ?? null,
            afpDailyQuota: afp.daily?.quota ?? null,
            afpDailyUsed: afp.daily?.used ?? null,
            afpDailyResetTime: afp.daily?.resetTime ?? null,
            afpWeeklyQuota: afp.weekly?.quota ?? null,
            afpWeeklyUsed: afp.weekly?.used ?? null,
            afpWeeklyResetTime: afp.weekly?.resetTime ?? null,
            afpMonthlyQuota: afp.monthly?.quota ?? null,
            afpMonthlyUsed: afp.monthly?.used ?? null,
            afpMonthlyResetTime: afp.monthly?.resetTime ?? null,
            rpm: limit?.RPM ?? null,
            tpm: limit?.TPM ?? null,
            token5hLimit: tokenWindows[18000] ?? null,
            tokenDailyLimit: tokenWindows[86400] ?? null,
            tokenWeeklyLimit: tokenWindows[604800] ?? null,
            tokenMonthlyLimit: tokenWindows[2592000] ?? null,
        }];
    },
});
