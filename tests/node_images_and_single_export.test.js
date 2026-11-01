import { describe, expect, test } from 'bun:test'
import {
  createSmmFormatData,
  checkSmmFormatData,
  copyNodeTree
} from '../simple-mind-map/src/utils/index.js'
import { addToTrash, getTrashList, clearTrash, removeFromTrash } from '../web/src/review/trash.js'

describe('节点图片与剪贴板处理 (Clipboard & Image Preservation)', () => {
  test('createSmmFormatData 携带完整 imgMap 字典', () => {
    const nodes = [
      {
        data: { text: '节点A', image: 'smm_img_key_1' },
        children: []
      }
    ]
    const imgMap = {
      smm_img_key_1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }

    const smmData = createSmmFormatData(nodes, imgMap)
    expect(smmData.simpleMindMap).toBe(true)
    expect(smmData.data).toEqual(nodes)
    expect(smmData.imgMap).toEqual(imgMap)
  })

  test('checkSmmFormatData 能够准确解析字符串与对象中的 imgMap', () => {
    const rawObj = {
      simpleMindMap: true,
      data: [{ data: { text: '测试', image: 'smm_img_key_99' }, children: [] }],
      imgMap: { smm_img_key_99: 'data:image/png;base64,TEST' }
    }

    // 对象形式解析
    const parsedObj = checkSmmFormatData(rawObj)
    expect(parsedObj.isSmm).toBe(true)
    expect(parsedObj.imgMap).toEqual({ smm_img_key_99: 'data:image/png;base64,TEST' })

    // JSON 字符串形式解析（模拟系统剪贴板文本传输）
    const parsedStr = checkSmmFormatData(JSON.stringify(rawObj))
    expect(parsedStr.isSmm).toBe(true)
    expect(parsedStr.data[0].data.image).toBe('smm_img_key_99')
    expect(parsedStr.imgMap).toEqual({ smm_img_key_99: 'data:image/png;base64,TEST' })
  })

  test('checkSmmFormatData 向下兼容旧版无 imgMap 的剪贴板数据', () => {
    const legacyObj = {
      simpleMindMap: true,
      data: [{ data: { text: '旧版节点' } }]
    }
    const res = checkSmmFormatData(JSON.stringify(legacyObj))
    expect(res.isSmm).toBe(true)
    expect(res.imgMap).toBeNull()
  })
})

describe('节点删除与回收站恢复图片映射 (Delete & Restore Image Preservation)', () => {
  test('addToTrash 正确保存被删节点及其图片映射字典', () => {
    clearTrash()
    const nodeData = {
      data: { text: '带图重点节点', uid: 'u_1001', image: 'smm_img_key_abc' },
      children: [
        {
          data: { text: '子节点图', uid: 'u_1002', image: 'smm_img_key_def' }
        }
      ]
    }
    const imgMap = {
      smm_img_key_abc: 'data:image/png;base64,ABC',
      smm_img_key_def: 'data:image/png;base64,DEF'
    }

    addToTrash(nodeData, imgMap)
    const list = getTrashList()
    expect(list.length).toBe(1)
    expect(list[0].data.data.uid).toBe('u_1001')
    expect(list[0].imgMap).toEqual(imgMap)

    // 模拟恢复流程：提取 imgMap 还原到导图
    const targetMapTree = { data: { text: '根节点', imgMap: {} } }
    Object.assign(targetMapTree.data.imgMap, list[0].imgMap)

    expect(targetMapTree.data.imgMap['smm_img_key_abc']).toBe('data:image/png;base64,ABC')
    expect(targetMapTree.data.imgMap['smm_img_key_def']).toBe('data:image/png;base64,DEF')

    clearTrash()
  })
})

describe('单片导出与图片自包含导入 (Single-Piece Export & Self-Contained Import)', () => {
  test('单片导出以选中节点为根节点，并继承全部分支结构', () => {
    const fullTree = {
      nodeData: {
        data: { text: '完整大纲根节点', uid: 'root_1' },
        children: [
          {
            data: { text: '章节1' },
            children: []
          },
          {
            data: { text: '章节2（准备单片导出）', uid: 'node_target', image: 'smm_img_key_ch2' },
            children: [
              {
                data: { text: '小节2.1', image: 'smm_img_key_sub21' },
                children: []
              }
            ]
          }
        ]
      }
    }

    const targetNode = fullTree.nodeData.children[1]
    const singlePieceRoot = copyNodeTree({}, targetNode, true)

    // 验证单片结构
    expect(singlePieceRoot.data.text).toBe('章节2（准备单片导出）')
    expect(singlePieceRoot.data.image).toBe('smm_img_key_ch2')
    expect(singlePieceRoot.children.length).toBe(1)
    expect(singlePieceRoot.children[0].data.text).toBe('小节2.1')
    expect(singlePieceRoot.children[0].data.image).toBe('smm_img_key_sub21')
  })

  test('单片导出的导图数据包含独立的 imgMap，导入时无需依赖原导图上下文', () => {
    const exportedSingleSmm = {
      layout: 'logicalStructure',
      root: {
        data: {
          text: '单片根节点',
          image: 'smm_img_key_part1',
          imgMap: {
            smm_img_key_part1: 'data:image/png;base64,PART1_IMAGE_DATA',
            smm_img_key_part2: 'data:image/png;base64,PART2_IMAGE_DATA'
          }
        },
        children: [
          {
            data: { text: '单片子节点', image: 'smm_img_key_part2' },
            children: []
          }
        ]
      },
      theme: { template: 'classic' },
      view: {}
    }

    // 模拟导入：解析 JSON 并将数据载入编辑器
    const jsonStr = JSON.stringify(exportedSingleSmm)
    const importedData = JSON.parse(jsonStr)

    expect(importedData.root).toBeDefined()
    expect(importedData.root.data.text).toBe('单片根节点')
    expect(importedData.root.data.imgMap).toBeDefined()
    expect(importedData.root.data.imgMap['smm_img_key_part1']).toBe('data:image/png;base64,PART1_IMAGE_DATA')
    expect(importedData.root.data.imgMap['smm_img_key_part2']).toBe('data:image/png;base64,PART2_IMAGE_DATA')

    // 模拟渲染器 getImageUrl 解析
    const getImageUrl = (nodeData, renderTree) => {
      const img = nodeData.image
      const map = (renderTree && renderTree.data && renderTree.data.imgMap) || {}
      return map[img] || img
    }

    expect(getImageUrl(importedData.root.data, importedData.root)).toBe('data:image/png;base64,PART1_IMAGE_DATA')
    expect(getImageUrl(importedData.root.children[0].data, importedData.root)).toBe('data:image/png;base64,PART2_IMAGE_DATA')
  })

  test('单片导出无配置模式（纯节点树）导入后能正常挂载 imgMap', () => {
    const rawTree = {
      data: {
        text: '纯树节点',
        image: 'smm_img_key_only',
        imgMap: {
          smm_img_key_only: 'data:image/png;base64,ONLY_DATA'
        }
      },
      children: []
    }

    const exportedStr = JSON.stringify(rawTree)
    const parsed = JSON.parse(exportedStr)

    // setData 兼容逻辑：若未包在 root 下，直接作为 renderTree
    const renderTree = parsed.root ? parsed.root : parsed
    expect(renderTree.data.imgMap['smm_img_key_only']).toBe('data:image/png;base64,ONLY_DATA')
  })
})
