import { CommandExecutionError } from '@jackwener/opencli/errors';

export const KIMI_DOMAIN = 'kimi.com';
export const KIMI_CONSOLE_URL = 'https://www.kimi.com/code/console';

// 4 张 dashboard 卡片（中文文案定位，i18n/改版即坏 -- 已知脆弱点，v1 接受）。
// modelCost 字段沿用 baseline 命名，实为模型档位描述（如「旗舰模型」），非 cost；保持列契约不改名。
const KIMI_CATEGORIES = ['本周用量', '频限明细', '我的权益', '模型权限'];

// API 绝对字段 deferred（user stories #7/#8/#10）：gRPC 网关需 access_token，refresh_token->access_token
// 逆向属 spec Out-of-Scope；page API 无 evaluateOnNewDocument，installInterceptor 不跨导航，raw fetch+cookie
// 返 401。v1 仅输出 DOM 卡片字段（百分比 + 档位 + 模型权限），绝对 limit/used/remaining、订阅价格、
// 5h enabled、余额用比留待 API 逆向后补。

export function parsePct(value) {
    const m = String(value || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Number(m[1]) : null;
}

export function requireCard(cards, name) {
    const values = cards[name];
    if (!Array.isArray(values) || values.length === 0) {
        throw new CommandExecutionError(`kimi usage returned malformed payload: missing "${name}" card`);
    }
    const normalized = values.map((value) => String(value || '').trim()).filter(Boolean);
    if (normalized.length === 0) {
        throw new CommandExecutionError(`kimi usage returned malformed payload: missing "${name}" card`);
    }
    return normalized;
}

// Page-side: 抓首个 <section> 下前 4 张可见卡，按 header 分类。Runs in page context.
function scrapeKimiCards() {
    const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
        return true;
    };
    const getDirectText = (el) => {
        let text = '';
        for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
        }
        return text.trim();
    };

    const section = document.querySelector('section');
    if (!section) return null;
    const cardContainer = section.children[0];
    if (!cardContainer) return null;

    const cardDivs = Array.from(cardContainer.children).filter(isVisible).slice(0, 4);
    const cards = {};
    for (const card of cardDivs) {
        const header = card.children[0];
        const body = card.children[1];
        if (!header || !body) continue;
        const categoryEl = header.querySelector('p');
        const category = categoryEl ? getDirectText(categoryEl) : '';
        if (!category) continue;
        const values = [...new Set(
            Array.from(body.querySelectorAll('span, p, div'))
                .filter(isVisible)
                .map(getDirectText)
                .filter((t) => t)
        )];
        if (values.length > 0) {
            cards[category] = values.slice(0, 3);
        }
    }
    return cards;
}

// 轮询等 4 卡齐全（修复 baseline 固定 page.wait(3) 的时序竞争：第 4 卡"模型权限"常未渲染完）。
export async function readKimiUsage(page, { maxAttempts = 12, intervalSec = 1 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const cards = await page.evaluate(`(${scrapeKimiCards.toString()})()`);
        if (cards && typeof cards === 'object' && !Array.isArray(cards) &&
            KIMI_CATEGORIES.every((c) => Array.isArray(cards[c]) && cards[c].length > 0)) {
            return cards;
        }
        if (attempt < maxAttempts - 1) {
            await page.wait(intervalSec);
        }
    }
    throw new CommandExecutionError('kimi usage returned malformed payload: 4 dashboard cards not ready after polling');
}
