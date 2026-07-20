import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { QIANWEN_DOMAIN, QIANWEN_URL, readQianwenUsage } from './utils.js';

export const usageCommand = cli({
    site: 'qianwen',
    name: 'usage',
    access: 'read',
    description: 'Read Qianwen Token Plan usage: dual-window quota (5h/7d), subscription status, and latest order.',
    domain: QIANWEN_DOMAIN,
    strategy: Strategy.COOKIE,
    browser: true,
    siteSession: 'persistent',
    navigateBefore: true,
    args: [],
    columns: [
        'planTier',
        'status',
        'remainingDays',
        'expireTime',
        'autoRenew',
        'quota5hRemainingPct',
        'quota5hTotal',
        'quota5hResetTime',
        'quota7dRemainingPct',
        'quota7dTotal',
        'quota7dResetTime',
        'orderId',
        'subscriptionName',
        'planName',
        'tradeType',
        'payTime',
        'payStatus',
        'amount',
    ],
    func: async (page) => {
        await page.goto(QIANWEN_URL);
        const data = await readQianwenUsage(page);
        if (!data || !data.planTier) {
            throw new CommandExecutionError('qianwen usage returned malformed payload: no usage data on the page');
        }
        return [{
            planTier: data.planTier,
            status: data.status ?? null,
            remainingDays: data.remainingDays ?? null,
            expireTime: data.expireTime ?? null,
            autoRenew: data.autoRenew,
            quota5hRemainingPct: data.quota5h?.remainingPct ?? null,
            quota5hTotal: data.quota5h?.total ?? null,
            quota5hResetTime: data.quota5h?.resetTime ?? null,
            quota7dRemainingPct: data.quota7d?.remainingPct ?? null,
            quota7dTotal: data.quota7d?.total ?? null,
            quota7dResetTime: data.quota7d?.resetTime ?? null,
            orderId: data.order?.orderId ?? null,
            subscriptionName: data.order?.subscriptionName ?? null,
            planName: data.order?.planName ?? null,
            tradeType: data.order?.tradeType ?? null,
            payTime: data.order?.payTime ?? null,
            payStatus: data.order?.payStatus ?? null,
            amount: data.order?.amount ?? null,
        }];
    },
});
