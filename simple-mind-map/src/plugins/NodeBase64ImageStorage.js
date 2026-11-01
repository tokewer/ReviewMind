import { walk, createUid } from '../utils/index'

// 修改base64格式的节点图片在数据中的存储方式
// 将base64格式的图片以key-map的形式存储在根节点的imgMap字段里，其他节点只保存key，避免不同的节点引用相同的图片重复存储的问题，普通url格式的图片不处理
class NodeBase64ImageStorage {
  constructor(opt) {
    this.opt = opt
    this.mindMap = opt.mindMap
    this.bindEvent()
  }

  bindEvent() {
    this.onBeforeAddHistory = this.onBeforeAddHistory.bind(this)
    this.mindMap.on('beforeAddHistory', this.onBeforeAddHistory)
  }

  unBindEvent() {
    this.mindMap.off('beforeAddHistory', this.onBeforeAddHistory)
  }

  isBase64ImgUrl(url) {
    return /^data:/.test(url)
  }

  isImageKey(url) {
    return /^smm_img_key_/.test(url)
  }

  createImageKey() {
    return 'smm_img_key_' + createUid()
  }

  onBeforeAddHistory() {
    const renderTree = this.mindMap.renderer.renderTree
    if (!renderTree) return
    let imgMap = renderTree.data.imgMap
    if (!imgMap) {
      imgMap = renderTree.data.imgMap = {}
    }
    const useIds = []

    const getImgIds = () => {
      return Object.keys(imgMap)
    }

    const getImgId = image => {
      return getImgIds().find(id => {
        return imgMap[id] === image
      })
    }

    walk(renderTree, null, node => {
      const image = node.data.image
      if (image) {
        // 如果是base64图片url
        if (this.isBase64ImgUrl(image)) {
          // 检查该图片是否已存在
          const hasId = getImgId(image)
          if (hasId) {
            // 已存在则直接使用现有的key
            useIds.push(hasId)
            node.data.image = hasId
          } else {
            // 不存在则生成key，并存储
            const newId = this.createImageKey()
            node.data.image = newId
            imgMap[newId] = image
            useIds.push(newId)
          }
        } else if (this.isImageKey(image)) {
          // 如果是key，那么收集一下
          if (getImgIds().includes(image)) {
            useIds.push(image)
          }
        }
      }
    })

    // 注意：不应在此处激进删除未引用图片，避免导致：
    // 1. 剪切节点（CUT）后粘贴时图片丢失
    // 2. 节点删除后撤回（Ctrl+Z）时图片丢失
    // 3. 节点放入回收站后恢复时图片丢失
    // 保留现有 imgMap 项，确保历史回退和恢复流程中图片始终可读可加载
  }

  // 手动清理无节点引用的图片（仅在显式需要时调用）
  cleanUnusedImages() {
    const renderTree = this.mindMap.renderer.renderTree
    if (!renderTree || !renderTree.data || !renderTree.data.imgMap) return
    const imgMap = renderTree.data.imgMap
    const useIds = []
    walk(renderTree, null, node => {
      const image = node.data.image
      if (image && this.isImageKey(image)) {
        useIds.push(image)
      }
    })
    Object.keys(imgMap).forEach(id => {
      if (!useIds.includes(id)) {
        delete imgMap[id]
      }
    })
  }

  // 插件被移除前做的事情
  beforePluginRemove() {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeBase64ImageStorage.instanceName = 'nodeBase64ImageStorage'

export default NodeBase64ImageStorage
