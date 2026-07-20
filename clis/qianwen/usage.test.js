import { beforeEach, describe, expect, it, vi } from 'vitest';

// Scraped payload shape returned by readQianwenUsage (raw values from the page,
// no derivation). Totals stay as rendered strings ("3,000"); unit is unknown.
const scrapeFixture = {
    planTier: 'Standard',
    status: '生效中',
    remainingDays: 31,
    expireTime: '2026-08-21 00:00:00',
    autoRenew: true,
    quota5h: { remainingPct: 98.4, total: '3,000', resetTime: '2026-07-21 01:28:00' },
    quota7d: { remainingPct: 94.4, total: '10,000', resetTime: '2026-07-27 09:20:00' },
    order: {
        orderId: '299359258570727',
        subscriptionName: 'Token Plan 个人版',
        planName: 'Standard套餐',
        tradeType: '新购',
        payTime: '2026-07-20 08:57:14',
        payStatus: '已支付',
        amount: '¥139.00',
    },
};

const expectedRow = {
    planTier: 'Standard',
    status: '生效中',
    remainingDays: 31,
    expireTime: '2026-08-21 00:00:00',
    autoRenew: true,
    quota5hRemainingPct: 98.4,
    quota5hTotal: '3,000',
    quota5hResetTime: '2026-07-21 01:28:00',
    quota7dRemainingPct: 94.4,
    quota7dTotal: '10,000',
    quota7dResetTime: '2026-07-27 09:20:00',
    orderId: '299359258570727',
    subscriptionName: 'Token Plan 个人版',
    planName: 'Standard套餐',
    tradeType: '新购',
    payTime: '2026-07-20 08:57:14',
    payStatus: '已支付',
    amount: '¥139.00',
};

const mocks = vi.hoisted(() => ({
    readQianwenUsage: vi.fn(),
}));

vi.mock('./utils.js', async () => {
    const actual = await vi.importActual('./utils.js');
    return {
        ...actual,
        readQianwenUsage: mocks.readQianwenUsage,
    };
});

import { usageCommand } from './usage.js';
import { QIANWEN_URL } from './utils.js';

function createPageMock() {
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        getCookies: vi.fn().mockResolvedValue([]),
        networkRequests: vi.fn().mockResolvedValue([]),
    };
}

describe('qianwen usage orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to the token-plan page and flattens the scraped payload into one row', async () => {
        const page = createPageMock();
        mocks.readQianwenUsage.mockResolvedValueOnce(scrapeFixture);

        const result = await usageCommand.func(page, {});

        expect(page.goto).toHaveBeenCalledWith(QIANWEN_URL);
        expect(mocks.readQianwenUsage).toHaveBeenCalledWith(page);
        expect(result).toEqual([expectedRow]);
    });

    it('throws when the page payload is missing or has no plan tier', async () => {
        const page = createPageMock();
        mocks.readQianwenUsage.mockResolvedValueOnce(null);
        await expect(usageCommand.func(page, {})).rejects.toThrow(/qianwen usage/);

        mocks.readQianwenUsage.mockResolvedValueOnce({ ...scrapeFixture, planTier: null });
        await expect(usageCommand.func(page, {})).rejects.toThrow(/qianwen usage/);
    });

    it('preserves raw values without deriving units or estimates', async () => {
        const page = createPageMock();
        mocks.readQianwenUsage.mockResolvedValueOnce(scrapeFixture);
        const [row] = await usageCommand.func(page, {});

        // 总额度原样字符串（含千分位），不转数字、不猜 token/credit 单位
        expect(row.quota5hTotal).toBe('3,000');
        expect(row.quota7dTotal).toBe('10,000');
        // 金额原样含币种符号
        expect(row.amount).toBe('¥139.00');
        // 百分比是数字
        expect(row.quota5hRemainingPct).toBe(98.4);
        // 自动续费是布尔（开关状态）
        expect(row.autoRenew).toBe(true);
        // 无派生 Dollar 估算字段
        expect(row).not.toHaveProperty('estimatedDollar');
        expect(row).not.toHaveProperty('dollarEstimate');
    });

    it('nulls missing optional fields instead of inventing them', async () => {
        const page = createPageMock();
        const partial = {
            planTier: 'Standard',
            status: '生效中',
            remainingDays: 31,
            expireTime: '2026-08-21 00:00:00',
            autoRenew: null,
            quota5h: { remainingPct: 98.4, total: '3,000', resetTime: '2026-07-21 01:28:00' },
            quota7d: null,
            order: null,
        };
        mocks.readQianwenUsage.mockResolvedValueOnce(partial);
        const [row] = await usageCommand.func(page, {});

        expect(row.autoRenew).toBeNull();
        expect(row.quota7dRemainingPct).toBeNull();
        expect(row.quota7dTotal).toBeNull();
        expect(row.amount).toBeNull();
        expect(row.orderId).toBeNull();
    });
});
