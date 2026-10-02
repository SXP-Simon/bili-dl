/**
 * B 站会话 Cookie 提取工具（支持读取 HttpOnly 的 SESSDATA 鉴权凭证）
 */

declare const GM_cookie: {
  list: (
    details: { domain?: string; name?: string },
    callback: (cookies: Array<{ name: string; value: string }>, error?: string) => void
  ) => void;
} | undefined;

/**
 * 异步获取当前页面用于鉴权的 Cookie 字符串
 * 优先使用 GM_cookie API 获取包括 HttpOnly 的 SESSDATA 凭据，解决外部下载器 403 问题
 */
export async function getBilibiliCookieHeader(): Promise<string> {
  try {
    if (typeof GM_cookie !== 'undefined' && typeof GM_cookie.list === 'function') {
      const cookieStr = await new Promise<string>((resolve) => {
        try {
          GM_cookie.list({ domain: '.bilibili.com' }, (cookies, error) => {
            if (!error && Array.isArray(cookies) && cookies.length > 0) {
              resolve(cookies.map((c) => `${c.name}=${c.value}`).join('; '));
            } else {
              resolve('');
            }
          });
        } catch {
          resolve('');
        }
      });
      if (cookieStr) return cookieStr;
    }
  } catch {}

  return typeof document !== 'undefined' ? document.cookie : '';
}
