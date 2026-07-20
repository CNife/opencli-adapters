import { cli, Strategy } from '@jackwener/opencli/registry';
import { KIMI_DOMAIN, KIMI_CONSOLE_URL, readKimiUsage, requireCard, parsePct } from './utils.js';

export const usageCommand = cli({
    site: 'kimi',
    name: 'usage',
    access: 'read',
    description: 'Read Kimi Code console usage cards: weekly usage, rate limit, membership, and model permission. DOM-only v1 (absolute API fields deferred).',
    domain: KIMI_DOMAIN,
    strategy: Strategy.COOKIE,
    browser: true,
    siteSession: 'persistent',
    navigateBefore: true,
    args: [],
    columns: [
        'weeklyUsagePct',
        'weeklyResetIn',
        'rateLimitPct',
        'rateLimitResetIn',
        'membershipName',
        'membershipTier',
        'modelPermission',
        'modelCost',
    ],
    func: async (page) => {
        await page.goto(KIMI_CONSOLE_URL);
        const cards = await readKimiUsage(page);

        const weekly = requireCard(cards, '本周用量');
        const rate = requireCard(cards, '频限明细');
        const member = requireCard(cards, '我的权益');
        const model = requireCard(cards, '模型权限');

        return [{
            weeklyUsagePct: parsePct(weekly[0]),
            weeklyResetIn: weekly.find((t) => /重置/.test(t)) || null,
            rateLimitPct: parsePct(rate[0]),
            rateLimitResetIn: rate.find((t) => /重置/.test(t)) || null,
            membershipName: member[0] || null,
            membershipTier: member.find((t) => t !== member[0]) || null,
            modelPermission: model[0] || null,
            modelCost: model.find((t) => t !== model[0]) || null,
        }];
    },
});
