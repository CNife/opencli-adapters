import { beforeEach, describe, expect, it, vi } from 'vitest';

// Scraped payload from readAgentPlanUsage: API AFP (4 windows, absolute Quota/Used + ISO reset,
// ResetTime ms epoch, -1 -> null) + current-tier RPM/TPM/token limits + DOM subscription.
// Agent Plan uses ABSOLUTE AFP values (unlike Coding Plan which is percentage-only).
const scrapeFixture = {
    afp: {
        apiError: null,
        planType: 'medium',
        afp: {
            fiveHour: { quota: 10000, used: 0, resetTime: null },
            daily: { quota: 50000, used: 0, resetTime: '2026-07-20T16:00:00.000Z' },
            weekly: { quota: 35000, used: 3591.6975, resetTime: '2026-08-01T00:00:00.000Z' },
            monthly: { quota: 100000, used: 5312.1208, resetTime: '2026-08-16T23:59:59.000Z' },
        },
    },
    subscription: {
        planType: 'Medium 套餐',
        status: '生效中',
        startTime: '2026-07-19 09:02',
        endTime: '2026-08-19 23:59',
        remainingDays: '31天',
        billingMode: '包月',
        autoRenew: true,
    },
    quotaLimit: {
        BizInfo: 'medium',
        RPM: 220,
        TPM: 2600000,
        TokenWindowLimits: [
            { DurationSeconds: 18000, Token: 100000000 },
            { DurationSeconds: 86400, Token: 500000000 },
            { DurationSeconds: 604800, Token: 350000000 },
            { DurationSeconds: 2592000, Token: 1000000000 },
        ],
    },
    quotaLimitError: null,
};

const expectedRow = {
    planType: 'Medium 套餐',
    subscriptionStatus: '生效中',
    startTime: '2026-07-19 09:02',
    endTime: '2026-08-19 23:59',
    remainingDays: '31天',
    billingMode: '包月',
    autoRenew: true,
    afpFiveHourQuota: 10000,
    afpFiveHourUsed: 0,
    afpFiveHourResetTime: null,
    afpDailyQuota: 50000,
    afpDailyUsed: 0,
    afpDailyResetTime: '2026-07-20T16:00:00.000Z',
    afpWeeklyQuota: 35000,
    afpWeeklyUsed: 3591.6975,
    afpWeeklyResetTime: '2026-08-01T00:00:00.000Z',
    afpMonthlyQuota: 100000,
    afpMonthlyUsed: 5312.1208,
    afpMonthlyResetTime: '2026-08-16T23:59:59.000Z',
    rpm: 220,
    tpm: 2600000,
    token5hLimit: 100000000,
    tokenDailyLimit: 500000000,
    tokenWeeklyLimit: 350000000,
    tokenMonthlyLimit: 1000000000,
};

const mocks = vi.hoisted(() => ({
    readAgentPlanUsage: vi.fn(),
}));

vi.mock('./utils.js', async () => {
    const actual = await vi.importActual('./utils.js');
    return { ...actual, readAgentPlanUsage: mocks.readAgentPlanUsage };
});

import { agentUsageCommand } from './agent-usage.js';
import { AGENT_PLAN_URL } from './utils.js';

function createPageMock() {
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        getCookies: vi.fn().mockResolvedValue([]),
        networkRequests: vi.fn().mockResolvedValue([]),
    };
}

describe('volcengine agent-usage orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to the agent-plan page and flattens AFP + limits + subscription into one row', async () => {
        const page = createPageMock();
        mocks.readAgentPlanUsage.mockResolvedValueOnce(scrapeFixture);

        const result = await agentUsageCommand.func(page, {});

        expect(page.goto).toHaveBeenCalledWith(AGENT_PLAN_URL);
        expect(mocks.readAgentPlanUsage).toHaveBeenCalledWith(page);
        expect(result).toEqual([expectedRow]);
    });

    it('throws when the payload is missing', async () => {
        const page = createPageMock();
        mocks.readAgentPlanUsage.mockResolvedValueOnce(null);
        await expect(agentUsageCommand.func(page, {})).rejects.toThrow(/agent-usage/);
    });

    it('outputs absolute AFP Quota/Used values, not percentages', async () => {
        const page = createPageMock();
        mocks.readAgentPlanUsage.mockResolvedValueOnce(scrapeFixture);
        const [row] = await agentUsageCommand.func(page, {});

        // Agent Plan 是绝对 AFP 值（非百分比）
        expect(row.afpWeeklyQuota).toBe(35000);
        expect(row.afpWeeklyUsed).toBe(3591.6975);
        expect(row.afpMonthlyUsed).toBe(5312.1208);
        // fiveHour ResetTime=-1 -> null（即将重置，无具体时间）
        expect(row.afpFiveHourResetTime).toBeNull();
        // 无百分比字段（Coding Plan 才有 percent）
        expect(row).not.toHaveProperty('weeklyPercent');
        expect(row).not.toHaveProperty('monthlyPercent');
        // token 限额是绝对 token 数
        expect(row.token5hLimit).toBe(100000000);
        expect(row.rpm).toBe(220);
    });

    it('nulls missing windows and limits instead of inventing them', async () => {
        const page = createPageMock();
        const partial = {
            ...scrapeFixture,
            afp: { ...scrapeFixture.afp, afp: { weekly: scrapeFixture.afp.afp.weekly } },
            quotaLimit: null,
        };
        mocks.readAgentPlanUsage.mockResolvedValueOnce(partial);
        const [row] = await agentUsageCommand.func(page, {});

        expect(row.afpWeeklyQuota).toBe(35000);
        expect(row.afpFiveHourQuota).toBeNull();
        expect(row.afpDailyQuota).toBeNull();
        expect(row.rpm).toBeNull();
        expect(row.token5hLimit).toBeNull();
    });
});
