import { beforeEach, describe, expect, it, vi } from 'vitest';

// Scraped payload from readCodingPlanUsage: API usage (3 windows, used percentage + ISO reset)
// + DOM subscription. Coding Plan has NO absolute quota/used -- percentage only.
const scrapeFixture = {
    status: 'Running',
    quotaUsage: [
        { level: 'session', percent: 34.7110615, resetTime: '2026-07-21T01:38:17.000Z' },
        { level: 'weekly', percent: 14.103824933333334, resetTime: '2026-08-01T00:00:00.000Z' },
        { level: 'monthly', percent: 12.150108699999999, resetTime: '2026-08-31T23:59:59.000Z' },
    ],
    apiError: null,
    subscription: {
        planType: 'Pro 套餐',
        status: '生效中',
        startTime: '2026-06-17 11:12',
        endTime: '2026-08-17 23:59',
        remainingDays: '29天',
        billingMode: '包月',
        autoRenew: true,
    },
};

const expectedRow = {
    planType: 'Pro 套餐',
    subscriptionStatus: '生效中',
    startTime: '2026-06-17 11:12',
    endTime: '2026-08-17 23:59',
    remainingDays: '29天',
    billingMode: '包月',
    autoRenew: true,
    sessionPercent: 34.7110615,
    sessionResetTime: '2026-07-21T01:38:17.000Z',
    weeklyPercent: 14.103824933333334,
    weeklyResetTime: '2026-08-01T00:00:00.000Z',
    monthlyPercent: 12.150108699999999,
    monthlyResetTime: '2026-08-31T23:59:59.000Z',
    apiStatus: 'Running',
};

const mocks = vi.hoisted(() => ({
    readCodingPlanUsage: vi.fn(),
}));

vi.mock('./utils.js', async () => {
    const actual = await vi.importActual('./utils.js');
    return { ...actual, readCodingPlanUsage: mocks.readCodingPlanUsage };
});

import { codingUsageCommand } from './coding-usage.js';
import { CODING_PLAN_URL } from './utils.js';

function createPageMock() {
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        getCookies: vi.fn().mockResolvedValue([]),
        networkRequests: vi.fn().mockResolvedValue([]),
    };
}

describe('volcengine coding-usage orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to the coding-plan page and flattens usage + subscription into one row', async () => {
        const page = createPageMock();
        mocks.readCodingPlanUsage.mockResolvedValueOnce(scrapeFixture);

        const result = await codingUsageCommand.func(page, {});

        expect(page.goto).toHaveBeenCalledWith(CODING_PLAN_URL);
        expect(mocks.readCodingPlanUsage).toHaveBeenCalledWith(page);
        expect(result).toEqual([expectedRow]);
    });

    it('throws when the payload is missing', async () => {
        const page = createPageMock();
        mocks.readCodingPlanUsage.mockResolvedValueOnce(null);
        await expect(codingUsageCommand.func(page, {})).rejects.toThrow(/coding-usage/);
    });

    it('outputs only percentages with no absolute quota/used values', async () => {
        const page = createPageMock();
        mocks.readCodingPlanUsage.mockResolvedValueOnce(scrapeFixture);
        const [row] = await codingUsageCommand.func(page, {});

        // Coding Plan 仅百分比，无绝对额度（Agent Plan 才有 Quota/Used）
        expect(row.sessionPercent).toBe(34.7110615);
        expect(row.weeklyPercent).toBe(14.103824933333334);
        expect(row.monthlyPercent).toBe(12.150108699999999);
        expect(row).not.toHaveProperty('sessionQuota');
        expect(row).not.toHaveProperty('sessionUsed');
        // resetTime 是 ISO 字符串
        expect(row.sessionResetTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('nulls missing windows instead of inventing them', async () => {
        const page = createPageMock();
        const partial = {
            ...scrapeFixture,
            quotaUsage: [{ level: 'session', percent: 34.7, resetTime: '2026-07-21T01:38:17.000Z' }],
        };
        mocks.readCodingPlanUsage.mockResolvedValueOnce(partial);
        const [row] = await codingUsageCommand.func(page, {});

        expect(row.sessionPercent).toBe(34.7);
        expect(row.weeklyPercent).toBeNull();
        expect(row.monthlyPercent).toBeNull();
    });
});
