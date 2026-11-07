import { describe, expect, test, beforeEach } from 'bun:test'
import KeyCommand from '../simple-mind-map/src/core/command/KeyCommand.js'

describe('KeyCommand 弹窗遮罩与表单输入快捷键防穿透测试', () => {
  let fakeMindMap
  let keyCommand

  beforeEach(() => {
    fakeMindMap = {
      opt: {},
      editNodeClassList: ['smm-node-edit-wrap', 'rich-text-edit-wrap'],
      renderer: {
        activeNodeList: [{ id: 'node_1', text: '物理力学' }]
      }
    }
    // 实例化时不调用 bindEvent 避免监听 window
    const origBind = KeyCommand.prototype.bindEvent
    KeyCommand.prototype.bindEvent = () => {}
    keyCommand = new KeyCommand({ mindMap: fakeMindMap })
    KeyCommand.prototype.bindEvent = origBind
  })

  test('常规画布元素按键不被拦截', () => {
    const fakeCanvasTarget = {
      tagName: 'svg',
      classList: { contains: () => false },
      closest: () => null
    }
    expect(keyCommand.isModalOrInputActive({ target: fakeCanvasTarget })).toBe(false)
  })

  test('导图节点编辑框按键放行（保证正常编辑文字）', () => {
    const fakeNodeEditTarget = {
      tagName: 'div',
      classList: { contains: cls => cls === 'smm-node-edit-wrap' },
      closest: sel => (sel === '.smm-node-edit-wrap' ? true : null)
    }
    expect(keyCommand.isModalOrInputActive({ target: fakeNodeEditTarget })).toBe(false)
  })

  test('输入框、多行文本域与选择器按键被拦截', () => {
    const inputTarget = {
      tagName: 'INPUT',
      classList: { contains: () => false },
      closest: () => null
    }
    expect(keyCommand.isModalOrInputActive({ target: inputTarget })).toBe(true)

    const textareaTarget = {
      tagName: 'TEXTAREA',
      classList: { contains: () => false },
      closest: () => null
    }
    expect(keyCommand.isModalOrInputActive({ target: textareaTarget })).toBe(true)
  })

  test('位于 Element UI 弹窗内部的事件被拦截', () => {
    const dialogBtnTarget = {
      tagName: 'BUTTON',
      classList: { contains: () => false },
      closest: selector => {
        if (selector.includes('.el-dialog')) return { className: 'el-dialog' }
        return null
      }
    }
    expect(keyCommand.isModalOrInputActive({ target: dialogBtnTarget })).toBe(true)
  })

  test('位于 AI 拷问弹窗或审核抽屉内的按键被拦截', () => {
    const interrogationOptionTarget = {
      tagName: 'DIV',
      classList: { contains: () => false },
      closest: selector => {
        if (selector.includes('.ai-interrogation-dialog')) return {}
        return null
      }
    }
    expect(keyCommand.isModalOrInputActive({ target: interrogationOptionTarget })).toBe(true)
  })

  test('全局存在可见遮罩层 v-modal 时按键被拦截', () => {
    const originalDoc = globalThis.document
    globalThis.document = {
      querySelectorAll: selector => {
        if (selector === '.v-modal') {
          return [{ style: { display: 'block' } }]
        }
        return []
      }
    }

    const canvasTarget = {
      tagName: 'svg',
      classList: { contains: () => false },
      closest: () => null
    }
    expect(keyCommand.isModalOrInputActive({ target: canvasTarget })).toBe(true)

    globalThis.document = originalDoc
  })

  test('当弹窗激活时 onKeydown 绝不会触发快捷键', () => {
    let shortcutTriggered = false
    keyCommand.shortcutMap['Enter'] = [
      () => {
        shortcutTriggered = true
      }
    ]

    // 模拟聚焦在弹窗内部
    const mockEvent = {
      target: {
        tagName: 'INPUT',
        classList: { contains: () => false },
        closest: () => null
      },
      keyCode: 13,
      key: 'Enter',
      stopPropagation: () => {},
      preventDefault: () => {}
    }

    keyCommand.onKeydown(mockEvent)
    expect(shortcutTriggered).toBe(false)
  })
})
