/**
 * Bilibili CDN 节点质量体系与智能调度管理模块
 */

export interface CdnNodeRule {
  id: string;
  name: string;
  desc: string;
  patterns: string[];
}

export const CDN_NODE_RULES: CdnNodeRule[] = [
  {
    id: 'cos',
    name: '腾讯云 COS',
    desc: '国内多线极速对象存储专线',
    patterns: ['mirrorcos', 'upcdnbd'],
  },
  {
    id: 'ali',
    name: '阿里云 OSS',
    desc: '国内骨干高速对象存储',
    patterns: ['mirrorali'],
  },
  {
    id: 'hw',
    name: '华为云 OBS',
    desc: '华为云大带宽对象存储',
    patterns: ['mirrorhw'],
  },
  {
    id: 'bos',
    name: '百度云 BOS',
    desc: '百度云高吞吐对象存储',
    patterns: ['mirrorbos'],
  },
  {
    id: 'tx',
    name: '腾讯直连',
    desc: '腾讯优质骨干直连节点',
    patterns: ['upcdntx'],
  },
  {
    id: 'ks3',
    name: '金山云 / BGP',
    desc: '金山云多线骨干 BGP',
    patterns: ['mirror08c', 'mirror08h'],
  },
  {
    id: 'ws',
    name: '网宿 CDN',
    desc: '网宿大型边缘加速网络',
    patterns: ['upcdnws'],
  },
  {
    id: 'bili',
    name: '标准 bilivideo',
    desc: 'B站官方标准主站节点',
    patterns: ['bilivideo.com', 'bilivideo.cn'],
  },
  {
    id: 'pcdn',
    name: 'PCDN 边缘节点',
    desc: '点对点分布式节点 (易卡顿波动)',
    patterns: ['mcdn'],
  },
  {
    id: 'oversea',
    name: '海外边缘节点',
    desc: 'Akamai / Fastly (跨国高延迟)',
    patterns: ['akamai', 'akamaized', 'fastly'],
  },
];

export const DEFAULT_CDN_ORDER: string[] = CDN_NODE_RULES.map((r) => r.id);

/**
 * 校验并规范化 CDN 排序列表（防止配置遗漏或损坏）
 */
export function normalizeCdnOrder(order?: string[]): string[] {
  if (!order || !Array.isArray(order)) return [...DEFAULT_CDN_ORDER];
  const valid = order.filter((id) => DEFAULT_CDN_ORDER.includes(id));
  const missing = DEFAULT_CDN_ORDER.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

/**
 * 获取指定 URL 匹配的 CDN 节点规则 ID
 * 先匹配特定厂商或特殊节点（PCDN、海外边缘、头部对象存储），最后回退到官方通用 bilivideo 节点
 */
export function getCdnNodeId(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    // 1. PCDN 节点
    if (host.includes('mcdn')) return 'pcdn';
    // 2. 海外边缘节点（Akamai / Fastly）
    if (host.includes('akamai') || host.includes('akamaized') || host.includes('fastly')) {
      return 'oversea';
    }
    // 3. 头部对象存储与专线
    for (const rule of CDN_NODE_RULES) {
      if (rule.id === 'pcdn' || rule.id === 'oversea' || rule.id === 'bili') continue;
      if (rule.patterns.some((p) => host.includes(p))) {
        return rule.id;
      }
    }
    // 4. 通用海外节点标识
    if (host.includes('ov.') || host.includes('-ov')) {
      return 'oversea';
    }
    // 5. 官方标准 bilivideo 节点
    if (host.includes('bilivideo.com') || host.includes('bilivideo.cn')) {
      return 'bili';
    }
  } catch {}
  return null;
}

/**
 * 获取指定 URL 的可读节点展示名称
 */
export function getCdnNodeLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('mirrorcos') || host.includes('upcdnbd')) return `腾讯云 COS (${host})`;
    if (host.includes('mirrorali')) return `阿里云 OSS (${host})`;
    if (host.includes('mirrorhw')) return `华为云 OBS (${host})`;
    if (host.includes('mirrorbos')) return `百度云 BOS (${host})`;
    if (host.includes('mirror08c') || host.includes('mirror08h')) return `金山云/BGP (${host})`;
    if (host.includes('upcdnws')) return `网宿 CDN (${host})`;
    if (host.includes('upcdntx')) return `腾讯直连 (${host})`;
    if (host.includes('mcdn')) return `PCDN 节点 (${host})`;
    if (host.includes('akamai') || host.includes('akamaized')) return `Akamai 海外 (${host})`;
    if (host.includes('fastly')) return `Fastly 海外 (${host})`;
    if (host.includes('ov.') || host.includes('-ov')) return `海外节点 (${host})`;
    if (host.includes('bilivideo.com') || host.includes('bilivideo.cn')) return `标准 bilivideo (${host})`;
    return host;
  } catch {
    return '未知节点';
  }
}

/**
 * 根据配置计算特定 URL 的优先级评分（分值越高优先级越高）
 */
export function getCdnPriorityScore(url: string, customOrder?: string[]): number {
  const order = normalizeCdnOrder(customOrder);
  const nodeId = getCdnNodeId(url);
  if (!nodeId) return 40; // 未知节点默认分
  const index = order.indexOf(nodeId);
  if (index === -1) return 30;
  // 越靠前得分越高
  let score = Math.max(1, (order.length - index) * 10);
  try {
    const host = new URL(url).hostname.toLowerCase();
    // 属于同等级厂商时，国内原生骨干节点优先于受限的海外 ov 节点
    if (
      host.includes('cosov') ||
      host.includes('aliov') ||
      host.includes('hwov') ||
      host.includes('bosov') ||
      host.includes('bsov') ||
      host.includes('ov.') ||
      host.includes('-ov')
    ) {
      score -= 2;
    }
  } catch {}
  return score;
}

/**
 * 根据 CDN 节点质量综合评分对候选 URL 进行降序排序（最高优先级在最前）
 */
export function sortCdnUrls(urls: string[], customOrder?: string[]): string[] {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  return uniqueUrls.sort((a, b) => getCdnPriorityScore(b, customOrder) - getCdnPriorityScore(a, customOrder));
}

/**
 * 当分配到了受限海外节点 (例如 mirrorcosov / mirroraliov 等) 时，
 * 自动衍生可用的国内 UPOS 骨干节点备选 (B站全 UPOS 节点共享 path 与签名密钥)
 */
export function expandCdnCandidates(rawUrls: string[]): string[] {
  const result: string[] = [];
  for (const url of rawUrls) {
    if (!url) continue;
    result.push(url);
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      // 如果分配到了海外限制节点 (如 mirrorcosov / mirroraliov 等)，自动衍生国内骨干优质节点
      if (
        host.includes('cosov') ||
        host.includes('aliov') ||
        host.includes('hwov') ||
        host.includes('bosov') ||
        host.includes('bsov') ||
        host.includes('ov.')
      ) {
        const domesticHosts = [
          'upos-sz-mirrorcos.bilivideo.com',
          'upos-sz-mirrorali.bilivideo.com',
          'upos-sz-mirrorhw.bilivideo.com',
          'upos-sz-mirror08c.bilivideo.com',
          'upos-sz-upcdnws.bilivideo.com',
        ];
        for (const dh of domesticHosts) {
          if (dh !== host) {
            result.push(url.replace(host, dh));
          }
        }
      }
    } catch {}
  }
  return Array.from(new Set(result));
}

/**
 * 统一获取排好序的 CDN URL 列表（内置多分片并发下载与外部持久化下载器共用此逻辑）
 */
export function getPrioritizedCdnUrls(
  baseUrl: string,
  backupUrls?: string[],
  settings?: { enableCdnPriority?: boolean; cdnPriorityOrder?: string[] }
): string[] {
  const rawUrls = [baseUrl, ...(backupUrls || [])].filter(Boolean);
  const expanded = expandCdnCandidates(rawUrls);
  if (settings?.enableCdnPriority === false) {
    return expanded;
  }
  return sortCdnUrls(expanded, settings?.cdnPriorityOrder);
}
