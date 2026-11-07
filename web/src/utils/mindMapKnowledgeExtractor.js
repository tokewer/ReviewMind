// ReviewMind 思维导图知识大纲提纯器
// 剥离布局坐标、样式颜色、富文本 HTML 标签，生成高 Token 效率的结构化知识大纲

const TAG_REGEX = /<[^>]+>/g

/**
 * 过滤 HTML 标签与实体字符
 */
export function stripHtml(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(TAG_REGEX, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
}

/**
 * 递归查找特定节点 ID 的子树
 */
export function findSubtree(node, targetId) {
  if (!node || !targetId) return null
  const currentId = node.data?.uid || node.data?.id || node.id
  if (currentId === targetId) return node

  const children = node.children || []
  for (const child of children) {
    const found = findSubtree(child, targetId)
    if (found) return found
  }
  return null
}

/**
 * 将 simple-mind-map 节点树递归转换为标准 Markdown 知识大纲
 * @param {Object} rootNodeData 根节点或子树对象
 * @param {Object} options 配置项 { maxDepth, focusNodeId, includeIds }
 * @returns {string} 纯文本 Markdown 结构大纲
 */
export function extractKnowledgeOutline(rootNodeData, options = {}) {
  const { maxDepth = 6, focusNodeId = null, includeIds = true } = options
  if (!rootNodeData) return ''

  let targetNode = rootNodeData
  if (focusNodeId) {
    const subtree = findSubtree(rootNodeData, focusNodeId)
    if (subtree) {
      targetNode = subtree
    }
  }

  const lines = []

  function traverse(node, depth = 1) {
    if (!node || depth > maxDepth) return

    const data = node.data || {}
    const text = stripHtml(data.text || '')
    const note = stripHtml(data.note || '')
    const tags = Array.isArray(data.tag) ? data.tag.filter(Boolean) : []
    const nodeId = data.uid || data.id || node.id || ''

    const indent = '  '.repeat(depth - 1)
    const idStr = includeIds && nodeId ? ` [ID: ${nodeId}]` : ''
    const tagStr = tags.length ? ` [标签: ${tags.join(', ')}]` : ''
    const noteStr = note ? ` (备注: ${note})` : ''

    if (text) {
      lines.append ? lines.append(`${indent}- ${text}${idStr}${tagStr}${noteStr}`) : lines.push(`${indent}- ${text}${idStr}${tagStr}${noteStr}`)
    }

    const children = node.children || []
    for (const child of children) {
      traverse(child, depth + 1)
    }
  }

  traverse(targetNode, 1)
  return lines.join('\n')
}

/**
 * 计算大纲统计信息（节点数、最大深度、字数）
 */
export function getOutlineMetrics(outlineText) {
  if (!outlineText) return { nodeCount: 0, charCount: 0, maxDepth: 0 }
  const lines = outlineText.split('\n').filter(l => l.trim().startsWith('-'))
  let maxIndent = 0

  lines.forEach(line => {
    const match = line.match(/^(\s*)-/)
    if (match) {
      const indentLevel = Math.floor(match[1].length / 2) + 1
      if (indentLevel > maxIndent) maxIndent = indentLevel
    }
  })

  return {
    nodeCount: lines.length,
    charCount: outlineText.length,
    maxDepth: maxIndent
  }
}
