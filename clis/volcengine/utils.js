import { CommandExecutionError } from '@jackwener/opencli/errors';

export const VOLCENGINE_DOMAIN = 'volcengine.com';
export const CODING_PLAN_URL = 'https://console.volcengine.com/ark/region:cn-beijing/subscription/coding-plan';
export const AGENT_PLAN_URL = 'https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan';

// CSRF token 从 csrfToken cookie 读，头名必须 X-CSRF-Token（活体探测确认：其他变体返 InvalidCSRFToken）。
// ListSubscribeTrade 需 ResourceTypes/ResourceNames/BizInfos 参数链 + ListAgentPlanHarnessOverdraftStatus
// 需 Edition 参数，research 均未记请求体，v1 走 DOM 拿套餐信息、透支状态 deferred（见各函数注释）。
// 所有 scrape*/fetch* 函数 run in page context, dependency-free for Function.prototype.toString 序列化。
// autoRenew 开关探测在 coding/agent 两处重复是序列化约束的已知代价（函数须自包含，无法提取共享 helper）。

// DOM: Coding Plan 套餐信息（ListSubscribeTrade 参数链未逆向，走 DOM）。
function scrapeCodingPlanSubscription() {
    const text = document.body.innerText;
    const m = (s, re) => {
        const r = s.match(re);
        return r ? r[1].trim() : null;
    };
    const subSection = text.split('套餐信息')[1] ? text.split('套餐信息')[1].split('用量统计')[0] : '';

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

    return {
        planType: m(subSection, /套餐类型\s+(.+)/),
        status: m(subSection, /订阅状态\s+(.+)/),
        startTime: m(subSection, /开始时间\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/),
        endTime: m(subSection, /结束时间\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/),
        remainingDays: m(subSection, /剩余时间\s+(\d+天)/),
        billingMode: m(subSection, /计费模式\s+(.+)/),
        autoRenew,
    };
}

// API: GetCodingPlanUsage - 3 窗口（session≈5h / weekly / monthly）已用百分比 + 绝对重置时间戳（秒）。
async function fetchCodingPlanUsage() {
    const csrf = document.cookie.split('csrfToken=')[1] ? document.cookie.split('csrfToken=')[1].split(';')[0] : null;
    const res = await fetch('https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetCodingPlanUsage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-CSRF-Token': csrf },
        body: '{}',
    });
    const json = await res.json();
    if (json.ResponseMetadata && json.ResponseMetadata.Error) {
        return { apiError: json.ResponseMetadata.Error.Code, status: null, quotaUsage: [] };
    }
    const result = json.Result || {};
    const toISO = (ts) => (ts && ts > 0 ? new Date(ts * 1000).toISOString() : null);
    const quotaUsage = (result.QuotaUsage || []).map((q) => ({
        level: q.Level,
        percent: q.Percent,
        resetTime: toISO(q.ResetTimestamp),
    }));
    return { apiError: null, status: result.Status, quotaUsage };
}

export async function readCodingPlanUsage(page) {
    const subscription = await page.evaluate(`(${scrapeCodingPlanSubscription.toString()})()`);
    const usage = await page.evaluate(`(${fetchCodingPlanUsage.toString()})()`);
    if (!subscription || typeof subscription !== 'object') {
        throw new CommandExecutionError('volcengine coding-usage returned malformed payload: subscription must be an object');
    }
    if (!usage || typeof usage !== 'object') {
        throw new CommandExecutionError('volcengine coding-usage returned malformed payload: usage must be an object');
    }
    return { status: usage.status, quotaUsage: usage.quotaUsage, apiError: usage.apiError, subscription };
}

// DOM: Agent Plan 套餐信息（同 coding，走 DOM）。
function scrapeAgentPlanSubscription() {
    const text = document.body.innerText;
    const m = (s, re) => {
        const r = s.match(re);
        return r ? r[1].trim() : null;
    };
    const subSection = text.split('套餐信息')[1] ? text.split('套餐信息')[1].split('使用配置')[0] : '';

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

    return {
        planType: m(subSection, /套餐类型\s+(.+)/),
        status: m(subSection, /订阅状态\s+(.+)/),
        startTime: m(subSection, /开始时间\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/),
        endTime: m(subSection, /结束时间\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/),
        remainingDays: m(subSection, /剩余时间\s+(\d+天)/),
        billingMode: m(subSection, /计费模式\s+(.+)/),
        autoRenew,
    };
}

// API: GetAgentPlanAFPUsage - 4 窗口 AFP 绝对 Quota/Used + ResetTime（ms epoch，-1 表无重置/即将重置）。
async function fetchAgentPlanAFPUsage() {
    const csrf = document.cookie.split('csrfToken=')[1] ? document.cookie.split('csrfToken=')[1].split(';')[0] : null;
    const res = await fetch('https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-CSRF-Token': csrf },
        body: '{}',
    });
    const json = await res.json();
    if (json.ResponseMetadata && json.ResponseMetadata.Error) {
        return { apiError: json.ResponseMetadata.Error.Code, planType: null, afp: null };
    }
    const r = json.Result || {};
    const toISO = (ts) => (ts && ts > 0 ? new Date(ts).toISOString() : null);
    const win = (w) => (w ? { quota: w.Quota, used: w.Used, resetTime: toISO(w.ResetTime) } : null);
    return {
        apiError: null,
        planType: r.PlanType,
        afp: {
            fiveHour: win(r.AFPFiveHour),
            daily: win(r.AFPDaily),
            weekly: win(r.AFPWeekly),
            monthly: win(r.AFPMonthly),
        },
    };
}

// API: ListAgentPlanPackageQuotaLimits - 各档 RPM/TPM/token 窗口限额（绝对 token 数）。
async function fetchAgentPlanPackageQuotaLimits() {
    const csrf = document.cookie.split('csrfToken=')[1] ? document.cookie.split('csrfToken=')[1].split(';')[0] : null;
    const res = await fetch('https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/ListAgentPlanPackageQuotaLimits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-CSRF-Token': csrf },
        body: '{}',
    });
    const json = await res.json();
    if (json.ResponseMetadata && json.ResponseMetadata.Error) {
        return { apiError: json.ResponseMetadata.Error.Code, limits: [] };
    }
    const limits = (json.Result && json.Result.PersonalQuotaLimits) || [];
    return { apiError: null, limits };
}

// Harness 透支状态 deferred: ListAgentPlanHarnessOverdraftStatus 需 Edition 参数（活体探测 "medium"
// 等档位名无效，正确值未逆向；响应结构混入模型列表），v1 暂不含透支字段，留待后续。
export async function readAgentPlanUsage(page) {
    const subscription = await page.evaluate(`(${scrapeAgentPlanSubscription.toString()})()`);
    const afp = await page.evaluate(`(${fetchAgentPlanAFPUsage.toString()})()`);
    const limitsRes = await page.evaluate(`(${fetchAgentPlanPackageQuotaLimits.toString()})()`);
    if (!subscription || typeof subscription !== 'object') {
        throw new CommandExecutionError('volcengine agent-usage returned malformed payload: subscription must be an object');
    }
    if (!afp || typeof afp !== 'object') {
        throw new CommandExecutionError('volcengine agent-usage returned malformed payload: afp must be an object');
    }
    const tier = afp.planType;
    const tierLimit = (limitsRes.limits || []).find((l) => l.BizInfo === tier) || null;
    return { afp, subscription, quotaLimit: tierLimit, quotaLimitError: limitsRes.apiError };
}
