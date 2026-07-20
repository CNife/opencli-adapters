import { beforeEach, describe, expect, it, vi } from 'vitest';

const goFixture = {
    rolling: { percent: 3, resetsIn: '1 小时 26 分钟' },
    weekly: { percent: 6, resetsIn: '6 天 9 小时' },
    monthly: { percent: 63, resetsIn: '9 天 1 小时' },
    subscribed: 'Active subscription',
};

const billingFixture = {
    zenBalance: '$0.00',
    cardLast4: '7403',
    autoTopup: 'disabled',
    monthlyLimit: 'not set',
    lastPayment: { amount: '$10.00', date: 'Jun 29, 4:36 PM' },
};

const expectedRows = [
    { Section: '滚动用量', Percent: 3, ResetsIn: '1 小时 26 分钟', Amount: null, Detail: 'Active subscription' },
    { Section: '每周用量', Percent: 6, ResetsIn: '6 天 9 小时', Amount: null, Detail: 'Active subscription' },
    { Section: '每月用量', Percent: 63, ResetsIn: '9 天 1 小时', Amount: null, Detail: 'Active subscription' },
    { Section: 'Zen Balance', Percent: null, ResetsIn: null, Amount: '$0.00', Detail: '自动充值 disabled | 每月限额 not set' },
    { Section: 'Last Payment', Percent: null, ResetsIn: null, Amount: '$10.00', Detail: 'Jun 29, 4:36 PM | card **7403' },
];

const mocks = vi.hoisted(() => ({
    readGoUsage: vi.fn(),
    readBilling: vi.fn(),
}));

vi.mock('./utils.js', async () => {
    const actual = await vi.importActual('./utils.js');
    return { ...actual, readGoUsage: mocks.readGoUsage, readBilling: mocks.readBilling };
});

import { goUsageCommand } from './go-usage.js';
import { DEFAULT_WORKSPACE, goUrl, billingUrl } from './utils.js';

function createPageMock() {
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        getCookies: vi.fn().mockResolvedValue([]),
        networkRequests: vi.fn().mockResolvedValue([]),
    };
}

describe('opencode go-usage orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates go + billing pages and assembles 5 rows', async () => {
        const page = createPageMock();
        mocks.readGoUsage.mockResolvedValueOnce(goFixture);
        mocks.readBilling.mockResolvedValueOnce(billingFixture);

        const result = await goUsageCommand.func(page, { workspace: DEFAULT_WORKSPACE });

        expect(page.goto).toHaveBeenNthCalledWith(1, goUrl(DEFAULT_WORKSPACE));
        expect(page.goto).toHaveBeenNthCalledWith(2, billingUrl(DEFAULT_WORKSPACE));
        expect(mocks.readGoUsage).toHaveBeenCalledWith(page);
        expect(mocks.readBilling).toHaveBeenCalledWith(page);
        expect(result).toEqual(expectedRows);
    });

    it('drops the derived dollar estimate on usage rows but keeps real billing dollars', async () => {
        const page = createPageMock();
        mocks.readGoUsage.mockResolvedValueOnce(goFixture);
        mocks.readBilling.mockResolvedValueOnce(billingFixture);
        const result = await goUsageCommand.func(page, { workspace: DEFAULT_WORKSPACE });

        const [rolling, weekly, monthly, zen, payment] = result;
        // go 行：砍 Dollar 估算（百分比×额度是派生值），Amount=null
        expect(rolling.Amount).toBeNull();
        expect(weekly.Amount).toBeNull();
        expect(monthly.Amount).toBeNull();
        // billing 行：真实 Dollar 保留
        expect(zen.Amount).toBe('$0.00');
        expect(payment.Amount).toBe('$10.00');
        // Section 用 DOM 原样中文（不硬编码英文 "Rolling (5h/$12)"，因 DOM 无额度 label）
        expect(rolling.Section).toBe('滚动用量');
        // 无估算 Dollar 字段
        expect(rolling).not.toHaveProperty('Usage(Dollar)');
    });

    it('parameterizes workspace', async () => {
        const page = createPageMock();
        mocks.readGoUsage.mockResolvedValueOnce(goFixture);
        mocks.readBilling.mockResolvedValueOnce(billingFixture);
        await goUsageCommand.func(page, { workspace: 'wrk_OTHER' });
        expect(page.goto).toHaveBeenNthCalledWith(1, goUrl('wrk_OTHER'));
        expect(page.goto).toHaveBeenNthCalledWith(2, billingUrl('wrk_OTHER'));
    });

    it('throws when both pages return nothing', async () => {
        const page = createPageMock();
        mocks.readGoUsage.mockResolvedValueOnce({ rolling: null, weekly: null, monthly: null, subscribed: null });
        mocks.readBilling.mockResolvedValueOnce({ zenBalance: null, lastPayment: null });
        await expect(goUsageCommand.func(page, { workspace: DEFAULT_WORKSPACE })).rejects.toThrow(/go-usage/);
    });
});
