// ReviewMind 统一数据埋点与百度统计封装模块
// 支持全站访客自动统计 (PV/UV) 与 SPA 单页应用路由切换无缝上报
// 支持环境隔离：localhost / 127.0.0.1 / 本地调试模式下静默拦截，严防污染线上统计

const DEBUG_STORAGE_KEY = 'reviewmind_debug_mode'
const BAIDU_TONGJI_ID_KEY = 'reviewmind_baidu_tongji_id'

// 全站默认百度统计站点 Token（用户专属 ID）
export const DEFAULT_BAIDU_TONGJI_ID = (typeof process !== 'undefined' && process.env && process.env.VUE_APP_BAIDU_TONGJI_ID)
  ? process.env.VUE_APP_BAIDU_TONGJI_ID
  : '1dc2a98c8539709ece738c4ff35433dd'

/**
 * 判断当前是否处于本地开发、局域网测试或站长调试模式
 */
export function isDevOrLocal() {
  if (typeof window === 'undefined' || !window.location) return true
  const hostname = window.location.hostname || ''
  const protocol = window.location.protocol || ''

  if (protocol === 'file:') return true
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true
  if (hostname.endsWith('.local') || hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true

  // 检查站长调试模式开关
  try {
    if (localStorage.getItem(DEBUG_STORAGE_KEY) === 'true') {
      return true
    }
  } catch (e) {}

  return false
}

/**
 * 获取当前生效的百度统计站点 Token
 */
export function getActiveBaiduTongjiId() {
  if (typeof window === 'undefined') return DEFAULT_BAIDU_TONGJI_ID
  try {
    return localStorage.getItem(BAIDU_TONGJI_ID_KEY) || DEFAULT_BAIDU_TONGJI_ID
  } catch (e) {
    return DEFAULT_BAIDU_TONGJI_ID
  }
}

/**
 * 设置全站百度统计 Token
 */
export function setBaiduTongjiId(siteId) {
  if (typeof window === 'undefined') return
  try {
    if (siteId) {
      localStorage.setItem(BAIDU_TONGJI_ID_KEY, siteId.trim())
      initBaiduAnalytics(siteId.trim())
    } else {
      localStorage.removeItem(BAIDU_TONGJI_ID_KEY)
    }
  } catch (e) {}
}

/**
 * 初始化百度统计（全站自动接入）
 * @param {string} [siteId] 百度统计站点 ID
 */
export function initBaiduAnalytics(siteId) {
  if (typeof window === 'undefined') return
  if (isDevOrLocal()) {
    console.info('[ReviewMind Analytics] 本地开发/调试环境已激活，百度统计已自动隔离静默拦截。')
    return
  }

  const id = siteId || getActiveBaiduTongjiId()
  if (!id) {
    // 未配置站点 ID 时静默待命，不产生网络开销
    return
  }

  window._hmt = window._hmt || []
  if (document.getElementById('baidu-tongji-script')) return

  const hm = document.createElement('script')
  hm.id = 'baidu-tongji-script'
  hm.src = `https://hm.baidu.com/hm.js?${id}`
  const s = document.getElementsByTagName('script')[0]
  if (s && s.parentNode) {
    s.parentNode.insertBefore(hm, s)
  } else {
    document.head.appendChild(hm)
  }
}

/**
 * SPA 单页应用页面浏览 (PV) 上报
 * 解决 Vue Router 跳转时只有首屏打开才计数的常见缺陷
 * @param {string} [pageUrl] 页面路径 (e.g. '/#/' 或 '/#/review')
 */
export function trackPageView(pageUrl) {
  if (typeof window === 'undefined') return false

  const path = pageUrl || (window.location ? (window.location.pathname + window.location.hash) : '')

  if (isDevOrLocal()) {
    console.log(
      `%c[Analytics Intercepted in Dev]%c PageView > ${path}`,
      'color: #8c8c8c; font-weight: bold;',
      'color: #52c41a;'
    )
    return false
  }

  try {
    window._hmt = window._hmt || []
    window._hmt.push(['_trackPageview', path])
    return true
  } catch (err) {
    return false
  }
}

/**
 * 统一自定义事件埋点上报
 * @param {string} category 事件类别 (e.g. 'Handwriting', 'Submission', 'AI_Grading', 'ReviewMind')
 * @param {string} action 事件操作 (e.g. 'Start_Writing', 'Submit_Answer', 'Update_Interval')
 * @param {string} [label] 事件标签 (e.g. 题目名/错误类型/分值)
 * @param {number} [value] 数值 (e.g. 耗时毫秒/间隔天数)
 */
export function trackEvent(category, action, label = '', value = 0) {
  if (typeof window === 'undefined') return false

  const isBlocked = isDevOrLocal()

  if (isBlocked) {
    // 本地开发环境仅控制台打印，严防脏数据上报
    console.log(
      `%c[Analytics Intercepted in Dev]%c ${category} > ${action}`,
      'color: #8c8c8c; font-weight: bold;',
      'color: #1890ff;',
      { label, value, timestamp: new Date().toLocaleTimeString() }
    )
    return false
  }

  try {
    window._hmt = window._hmt || []
    window._hmt.push([
      '_trackEvent',
      String(category),
      String(action),
      String(label),
      Number(value) || 0
    ])
    return true
  } catch (err) {
    console.warn('[Analytics Error]', err)
    return false
  }
}
