// ReviewMind 统一数据埋点与百度统计封装模块
// 支持环境隔离：localhost / 127.0.0.1 / 本地调试模式下静默拦截，严防污染线上统计

const DEBUG_STORAGE_KEY = 'reviewmind_debug_mode'
const BAIDU_TONGJI_ID_KEY = 'reviewmind_baidu_tongji_id'

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
 * 初始化百度统计（可在 index.html 中引入，也可在此动态加载）
 * @param {string} [siteId] 百度统计站点 ID
 */
export function initBaiduAnalytics(siteId) {
  if (typeof window === 'undefined') return
  if (isDevOrLocal()) {
    console.info('[ReviewMind Analytics] 本地开发/调试环境已激活，百度统计已自动隔离静默拦截。')
    return
  }

  const id = siteId || localStorage.getItem(BAIDU_TONGJI_ID_KEY)
  if (!id) return

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
