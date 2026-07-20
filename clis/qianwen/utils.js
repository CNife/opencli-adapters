import { CommandExecutionError } from '@jackwener/opencli/errors';

export const QIANWEN_DOMAIN = 'qianwenai.com';
export const QIANWEN_URL = 'https://platform.qianwenai.com/home/billing/subscription/token-plan-individual';

// Runs in the page context. Kept dependency-free so it can be serialized via
// Function.prototype.toString and evaluated by page.evaluate. Raw values only --
// totals stay as rendered strings (e.g. "3,000"), no unit is inferred.
function scrapeQianwenUsage() {
    const text = document.body.innerText;
    const m = (s, re) => {
        const r = s.match(re);
        return r ? r[1].trim() : null;
    };
    const parseNum = (s) => {
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    };

    const planSection = text.split('订阅历史')[0] || text;
    const q5hPart = planSection.split('每 5 小时额度')[1];
    const q5hBlock = q5hPart ? q5hPart.split('每 7 天额度')[0] : '';
    const q7dPart = planSection.split('每 7 天额度')[1];
    const q7dBlock = q7dPart ? q7dPart.split('订阅历史')[0] : '';

    const planTier = m(text, /(Standard|Lite|Pro)\s*套餐/);
    const status = m(planSection, /状态\s+(\S+)/);
    const remainingDays = m(planSection, /剩余天数\s+(\d+)\s*天/);
    const expireTime = m(planSection, /到期时间\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);

    // 自动续费 toggle: <button role="switch" aria-checked="true|false">
    let autoRenew = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        if (node.textContent.trim() === '自动续费') {
            let p = node.parentElement;
            for (let i = 0; i < 5; i++) {
                if (!p) break;
                const sw = p.querySelector('[role="switch"]');
                if (sw) {
                    autoRenew = sw.getAttribute('aria-checked') === 'true';
                    break;
                }
                p = p.parentElement;
            }
            break;
        }
    }

    // 订阅历史表: 取第一数据行（最近订单）。DOM 仅渲染应付金额，原价/优惠未展示，不猜。
    let order = null;
    const tables = document.querySelectorAll('table');
    if (tables.length) {
        const t = tables[tables.length - 1];
        const rows = Array.from(t.querySelectorAll('tr')).filter((r) => r.querySelectorAll('th,td').length > 1);
        const dataRow = rows.find((r) => !r.querySelector('th'));
        if (dataRow) {
            const cells = Array.from(dataRow.querySelectorAll('td')).map((c) => c.innerText.trim());
            if (cells.length >= 7) {
                order = {
                    orderId: cells[0],
                    subscriptionName: cells[1],
                    planName: cells[2],
                    tradeType: cells[3],
                    payTime: cells[4],
                    payStatus: cells[5],
                    amount: cells[6],
                };
            }
        }
    }

    return {
        planTier,
        status,
        remainingDays: remainingDays ? Number(remainingDays) : null,
        expireTime,
        autoRenew,
        quota5h: {
            remainingPct: parseNum(m(q5hBlock, /剩余量\s*(\d+(?:\.\d+)?)%/)),
            total: m(q5hBlock, /总额度\s*([\d,]+)/),
            resetTime: m(q5hBlock, /额度重置时间\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/),
        },
        quota7d: {
            remainingPct: parseNum(m(q7dBlock, /剩余量\s*(\d+(?:\.\d+)?)%/)),
            total: m(q7dBlock, /总额度\s*([\d,]+)/),
            resetTime: m(q7dBlock, /额度重置时间\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/),
        },
        order,
    };
}

export async function readQianwenUsage(page) {
    const data = await page.evaluate(`(${scrapeQianwenUsage.toString()})()`);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new CommandExecutionError('qianwen usage returned malformed payload: usage data must be an object');
    }
    return data;
}
