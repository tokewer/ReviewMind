import { keyMap } from './keyMap.js'

//  快捷按键、命令处理类
export default class KeyCommand {
  //  构造函数
  constructor(opt) {
    this.opt = opt
    this.mindMap = opt.mindMap
    this.shortcutMap = {
      //Enter: [fn]
    }
    this.shortcutMapCache = {}
    this.isPause = false
    this.isInSvg = false
    this.isStopCheckInSvg = false
    this.defaultEnableCheck = this.defaultEnableCheck.bind(this)
    this.bindEvent()
  }

  // 扩展按键映射
  extendKeyMap(key, code) {
    keyMap[key] = code
  }

  // 从按键映射中删除某个键
  removeKeyMap(key) {
    if (typeof keyMap[key] !== 'undefined') {
      delete keyMap[key]
    }
  }

  //  暂停快捷键响应
  pause() {
    this.isPause = true
  }

  //  恢复快捷键响应
  recovery() {
    this.isPause = false
  }

  //  保存当前注册的快捷键数据，然后清空快捷键数据
  save() {
    // 当前已经存在缓存数据了，那么直接返回
    if (Object.keys(this.shortcutMapCache).length > 0) {
      return
    }
    this.shortcutMapCache = this.shortcutMap
    this.shortcutMap = {}
  }

  //  恢复保存的快捷键数据，然后清空缓存数据
  restore() {
    // 当前不存在缓存数据，那么直接返回
    if (Object.keys(this.shortcutMapCache).length <= 0) {
      return
    }
    this.shortcutMap = this.shortcutMapCache
    this.shortcutMapCache = {}
  }

  // 停止对鼠标是否在画布内的检查，前提是开启了enableShortcutOnlyWhenMouseInSvg选项
  // 库内部节点文本编辑、关联线文本编辑、外框文本编辑前都会暂停检查，否则无法响应回车快捷键用于结束编辑
  // 如果你新增了额外的文本编辑，也可以在编辑前调用此方法
  stopCheckInSvg() {
    const { enableShortcutOnlyWhenMouseInSvg } = this.mindMap.opt
    if (!enableShortcutOnlyWhenMouseInSvg) return
    this.isStopCheckInSvg = true
  }

  // 恢复对鼠标是否在画布内的检查
  recoveryCheckInSvg() {
    const { enableShortcutOnlyWhenMouseInSvg } = this.mindMap.opt
    if (!enableShortcutOnlyWhenMouseInSvg) return
    this.isStopCheckInSvg = false
  }

  //  绑定事件
  bindEvent() {
    this.onKeydown = this.onKeydown.bind(this)
    this.onWindowFocus = this.onWindowFocus.bind(this)
    this.onWindowBlur = this.onWindowBlur.bind(this)
    // 只有当鼠标在画布内才响应快捷键
    this.mindMap.on('svg_mouseenter', () => {
      this.isInSvg = true
    })
    this.mindMap.on('svg_mouseleave', () => {
      this.isInSvg = false
    })
    window.addEventListener('keydown', this.onKeydown)
    window.addEventListener('focus', this.onWindowFocus)
    window.addEventListener('blur', this.onWindowBlur)
    this.mindMap.on('beforeDestroy', () => {
      this.unBindEvent()
    })
  }

  // 解绑事件
  unBindEvent() {
    window.removeEventListener('keydown', this.onKeydown)
    window.removeEventListener('focus', this.onWindowFocus)
    window.removeEventListener('blur', this.onWindowBlur)
  }

  // 窗口重新获得焦点（如切屏回来、Alt+F4 取消回来）
  onWindowFocus() {
    // 若当前有激活节点或当前焦点在页面主区域，且不在外部 input/textarea 等表单中，恢复快捷键可用状态
    const activeNodes = (this.mindMap.renderer && this.mindMap.renderer.activeNodeList) || []
    if (activeNodes.length > 0) {
      this.isInSvg = true
    }
  }

  // 窗口失去焦点（切屏出去）
  onWindowBlur() {
    // 避免修饰键锁死在按下状态
    this.isInSvg = false
  }

  // 根据事件目标判断是否响应快捷键事件
  defaultEnableCheck(e) {
    const target = e.target
    if (target === document.body) return true
    for (let i = 0; i < this.mindMap.editNodeClassList.length; i++) {
      const cur = this.mindMap.editNodeClassList[i]
      if (target.classList.contains(cur)) {
        return true
      }
    }
    return false
  }

  // 判断当前是否有弹窗、抽屉、消息浮层或外部表单元素正在接收用户交互，避免快捷键穿透控制背景节点
  isModalOrInputActive(e) {
    try {
      const target = e && e.target
      if (!target) return false

      // 1. 如果是在思维导图节点本身的富文本/节点编辑框中，这是合法的节点编辑行为，允许通过
      const editNodeClassList = this.mindMap.editNodeClassList || []
      for (let i = 0; i < editNodeClassList.length; i++) {
        const cur = editNodeClassList[i]
        if (target.classList && target.classList.contains && target.classList.contains(cur)) {
          return false
        }
        if (target.closest && target.closest('.' + cur)) {
          return false
        }
      }

      // 2. 检查事件目标是否是外部输入组件（input, textarea, select, contenteditable, 富文本编辑器）
      const tagName = (target.tagName || '').toUpperCase()
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) {
        return true
      }
      if (target.isContentEditable) {
        return true
      }
      if (target.closest && target.closest('input, textarea, select, [contenteditable="true"], .el-input, .el-textarea, .toastui-editor-defaultUI')) {
        return true
      }

      // 3. 检查事件目标是否位于弹窗、抽屉、消息框、下拉菜单、颜色选择器或侧边浮层内
      if (target.closest && target.closest(
        '.el-dialog, .el-drawer, .el-message-box, .el-popover, .el-dropdown-menu, ' +
        '.el-select-dropdown, .el-color-picker__panel, .contextmenuContainer, .fileTreeBox, ' +
        '.ai-interrogation-dialog, .review-ai-config-dialog, .ai-audit-drawer, .sidebar-container, .dialogContainer'
      )) {
        return true
      }

      // 4. 全局检查：当前是否有任何可见的遮罩层或弹窗/抽屉处于打开状态
      if (typeof document !== 'undefined' && document.querySelectorAll) {
        // 检查遮罩层 (Element UI v-modal)
        const vModals = document.querySelectorAll('.v-modal')
        for (let i = 0; i < vModals.length; i++) {
          const vm = vModals[i]
          if (vm && vm.style && vm.style.display !== 'none') {
            return true
          }
        }
        // 检查未处于 display: none 的弹窗与抽屉容器
        const dialogWrappers = document.querySelectorAll(
          '.el-dialog__wrapper, .el-drawer__wrapper, .el-message-box__wrapper, .dialogContainer'
        )
        for (let i = 0; i < dialogWrappers.length; i++) {
          const wrapper = dialogWrappers[i]
          if (wrapper && wrapper.style && wrapper.style.display !== 'none') {
            if (typeof window !== 'undefined' && window.getComputedStyle) {
              const style = window.getComputedStyle(wrapper)
              if (style && style.display !== 'none' && style.visibility !== 'hidden') {
                return true
              }
            } else {
              return true
            }
          }
        }
      }
    } catch (err) {
      // 容错处理
    }
    return false
  }

  // 按键事件
  onKeydown(e) {
    if (this.isModalOrInputActive(e)) {
      return
    }
    const {
      enableShortcutOnlyWhenMouseInSvg,
      beforeShortcutRun,
      customCheckEnableShortcut
    } = this.mindMap.opt
    if (typeof customCheckEnableShortcut === 'function') {
      if (!customCheckEnableShortcut(e)) return
    }
    const activeNodes =
      (this.mindMap.renderer && this.mindMap.renderer.activeNodeList) || []
    const hasActiveNode = activeNodes.length > 0
    if (
      this.isPause ||
      (enableShortcutOnlyWhenMouseInSvg &&
        !this.isStopCheckInSvg &&
        !this.isInSvg &&
        !hasActiveNode)
    ) {
      return
    }
    Object.keys(this.shortcutMap).forEach(key => {
      if (this.checkKey(e, key)) {
        // 粘贴事件不组织，因为要监听paste事件
        if (!this.checkKey(e, 'Control+v')) {
          e.stopPropagation()
          e.preventDefault()
        }
        if (typeof beforeShortcutRun === 'function') {
          const isStop = beforeShortcutRun(key, [
            ...this.mindMap.renderer.activeNodeList
          ])
          if (isStop) return
        }
        this.shortcutMap[key].forEach(fn => {
          fn()
        })
      }
    })
  }

  //  检查键值是否符合
  checkKey(e, key) {
    let o = this.getOriginEventCodeArr(e)
    let k = this.getKeyCodeArr(key)
    if (o.length !== k.length) {
      return false
    }
    for (let i = 0; i < o.length; i++) {
      let index = k.findIndex(item => {
        return item === o[i]
      })
      if (index === -1) {
        return false
      } else {
        k.splice(index, 1)
      }
    }
    return true
  }

  //  获取事件对象里的键值数组
  getOriginEventCodeArr(e) {
    let arr = []
    if (e.ctrlKey || e.metaKey) {
      arr.push(keyMap['Control'])
    }
    if (e.altKey) {
      arr.push(keyMap['Alt'])
    }
    if (e.shiftKey) {
      arr.push(keyMap['Shift'])
    }
    if (!arr.includes(e.keyCode)) {
      arr.push(e.keyCode)
    }
    return arr
  }

  // 判断是否按下了组合键
  hasCombinationKey(e) {
    return e.ctrlKey || e.metaKey || e.altKey || e.shiftKey
  }

  //  获取快捷键对应的键值数组
  getKeyCodeArr(key) {
    let keyArr = key.split(/\s*\+\s*/)
    let arr = []
    keyArr.forEach(item => {
      arr.push(keyMap[item])
    })
    return arr
  }

  //  添加快捷键命令
  /**
   * Enter
   * Tab | Insert
   * Shift + a
   */
  addShortcut(key, fn) {
    key.split(/\s*\|\s*/).forEach(item => {
      if (this.shortcutMap[item]) {
        this.shortcutMap[item].push(fn)
      } else {
        this.shortcutMap[item] = [fn]
      }
    })
  }

  //  移除快捷键命令
  removeShortcut(key, fn) {
    key.split(/\s*\|\s*/).forEach(item => {
      if (this.shortcutMap[item]) {
        if (fn) {
          let index = this.shortcutMap[item].findIndex(f => {
            return f === fn
          })
          if (index !== -1) {
            this.shortcutMap[item].splice(index, 1)
          }
        } else {
          this.shortcutMap[item] = []
          delete this.shortcutMap[item]
        }
      }
    })
  }

  //  获取指定快捷键的处理函数
  getShortcutFn(key) {
    let res = []
    key.split(/\s*\|\s*/).forEach(item => {
      res = this.shortcutMap[item] || []
    })
    return res
  }
}
