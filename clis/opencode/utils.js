import { CommandExecutionError } from '@jackwener/opencli/errors';

export const OPENCODE_DOMAIN = 'opencode.ai';
// workspace 参数化（user story #6）：默认研究里的已知 ws，用户可传 --workspace 覆盖。
export const DEFAULT_WORKSPACE = 'wrk_01KF318TX8BJ81JNBEZSJWJGWD';

export function goUrl(workspace) {
    return `https://opencode.ai/workspace/${workspace}/go`;
}

export function billingUrl(workspace) {
    return `https://opencode.ai/workspace/${workspace}/billing`;
}

// Go 页 DOM 不含额度 label（$12/$30/$60 不在页面，旧 adapter 是硬编码）-- user story #5
// （额度动态读）受数据源限制无法实现；user story #4（砍 Dollar 估算）仍满足：go 行不输出
// 百分比×额度的估算 Dollar，仅 Zen Balance / Last Payment 的真实 Dollar 保留。
// Runs in page context, dependency-free for Function.prototype.toString 序列化。
function scrapeGoUsage() {
    const text = document.body.innerText;
    const m = (label) => {
        const re = new RegExp(label + '\\s+(\\d+(?:\\.\\d+)?)%\\s+重置于\\s+([^\\n]+)');
        const r = text.match(re);
        return r ? { percent: Number(r[1]), resetsIn: r[2].trim() } : null;
    };
    return {
        rolling: m('滚动用量'),
        weekly: m('每周用量'),
        monthly: m('每月用量'),
        subscribed: /您已订阅 OpenCode Go/.test(text) ? 'Active subscription' : null,
    };
}

function scrapeBilling() {
    const text = document.body.innerText;
    const balanceMatch = text.match(/\$(\d+(?:\.\d+)?)\s*当前余额/);
    const cardMatch = text.match(/••••\s*(\d{4})/);
    const autoTopup = /自动充值已\s*禁用/.test(text)
        ? 'disabled'
        : (/自动充值已\s*启用/.test(text) ? 'enabled' : null);
    const monthlyLimit = /未设置使用限额/.test(text) ? 'not set' : null;
    const payMatch = text.match(/([A-Z][a-z]{2} \d+, \d{1,2}:\d{2} [AP]M)\s+pay_\w+\s+\$(\d+(?:\.\d+)?)/);
    return {
        zenBalance: balanceMatch ? '$' + balanceMatch[1] : null,
        cardLast4: cardMatch ? cardMatch[1] : null,
        autoTopup,
        monthlyLimit,
        lastPayment: payMatch ? { amount: '$' + payMatch[2], date: payMatch[1] } : null,
    };
}

export async function readGoUsage(page) {
    const data = await page.evaluate(`(${scrapeGoUsage.toString()})()`);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new CommandExecutionError('opencode go-usage returned malformed payload: go data must be an object');
    }
    return data;
}

export async function readBilling(page) {
    const data = await page.evaluate(`(${scrapeBilling.toString()})()`);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new CommandExecutionError('opencode go-usage returned malformed payload: billing data must be an object');
    }
    return data;
}
