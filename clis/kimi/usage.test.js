import { beforeEach, describe, expect, it, vi } from 'vitest';

// Scraped payload from readKimiUsage: 4 dashboard cards (DOM v1). API absolute fields
// (limit/used/remaining, price, 5h enabled, balance ratio) are deferred (refresh_token reverse
// is Out-of-Scope), so only DOM card values are present.
const scrapeFixture = {
    '本周用量': ['26%', '82 小时后重置'],
    '频限明细': ['0%', '4 小时后重置'],
    '我的权益': ['Allegretto', '会员'],
    '模型权限': ['K3', '旗舰模型'],
};

const expectedRow = {
    weeklyUsagePct: 26,
    weeklyResetIn: '82 小时后重置',
    rateLimitPct: 0,
    rateLimitResetIn: '4 小时后重置',
    membershipName: 'Allegretto',
    membershipTier: '会员',
    modelPermission: 'K3',
    modelCost: '旗舰模型',
};

const mocks = vi.hoisted(() => ({
    readKimiUsage: vi.fn(),
}));

vi.mock('./utils.js', async () => {
    const actual = await vi.importActual('./utils.js');
    return { ...actual, readKimiUsage: mocks.readKimiUsage };
});

import { usageCommand } from './usage.js';
import { KIMI_CONSOLE_URL } from './utils.js';

function createPageMock() {
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        getCookies: vi.fn().mockResolvedValue([]),
        networkRequests: vi.fn().mockResolvedValue([]),
    };
}

describe('kimi usage orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to the console and maps the 4 cards into one row', async () => {
        const page = createPageMock();
        mocks.readKimiUsage.mockResolvedValueOnce(scrapeFixture);

        const result = await usageCommand.func(page, {});

        expect(page.goto).toHaveBeenCalledWith(KIMI_CONSOLE_URL);
        expect(mocks.readKimiUsage).toHaveBeenCalledWith(page);
        expect(result).toEqual([expectedRow]);
    });

    it('propagates the polling-timeout error when cards never become ready', async () => {
        const page = createPageMock();
        mocks.readKimiUsage.mockRejectedValueOnce(new Error('kimi usage returned malformed payload: 4 dashboard cards not ready after polling'));
        await expect(usageCommand.func(page, {})).rejects.toThrow(/not ready/);
    });

    it('throws when a required card is missing from the payload', async () => {
        const page = createPageMock();
        mocks.readKimiUsage.mockResolvedValueOnce({
            '本周用量': ['26%', '82 小时后重置'],
            '频限明细': ['0%', '4 小时后重置'],
            '我的权益': ['Allegretto', '会员'],
        });
        await expect(usageCommand.func(page, {})).rejects.toThrow(/模型权限/);
    });

    it('outputs DOM percentages and raw reset strings, with no derived absolute fields', async () => {
        const page = createPageMock();
        mocks.readKimiUsage.mockResolvedValueOnce(scrapeFixture);
        const [row] = await usageCommand.func(page, {});

        // 百分比是数字
        expect(row.weeklyUsagePct).toBe(26);
        expect(row.rateLimitPct).toBe(0);
        // 重置文案原样字符串（不转绝对时间 -- DOM 只有倒计时）
        expect(row.weeklyResetIn).toBe('82 小时后重置');
        // 无 API 绝对字段（deferred）
        expect(row).not.toHaveProperty('weeklyLimit');
        expect(row).not.toHaveProperty('weeklyUsed');
        expect(row).not.toHaveProperty('weeklyRemaining');
        expect(row).not.toHaveProperty('subscriptionPrice');
    });
});
