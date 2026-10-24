<template>
  <el-dialog
    :title="isEditing ? '编辑表格（Logseq 风格）' : '插入表格（Logseq 风格）'"
    :visible.sync="visible"
    width="860px"
    :append-to-body="true"
    custom-class="nodeTableDialog"
    @opened="onDialogOpened"
  >
    <div class="tableDialogPanel" :class="{ isDark: isDark }">
      <!-- 模式切换选项卡 -->
      <el-tabs v-model="activeTab" type="card" @tab-click="onTabChange">
        <el-tab-pane label="📊 可视化设计" name="visual"></el-tab-pane>
        <el-tab-pane label="📝 Markdown 源码" name="markdown"></el-tab-pane>
        <el-tab-pane label="📋 快速导入 (Excel/CSV)" name="import"></el-tab-pane>
      </el-tabs>

      <!-- 前置文字 -->
      <div class="nodeTitleRow" v-if="activeTab !== 'import'">
        <span class="label">前置文字（节点标题/说明）:</span>
        <el-input
          v-model="prefixText"
          size="small"
          placeholder="可在此输入表格前的知识点标题或说明（可选）"
        ></el-input>
      </div>

      <!-- Tab 1: 可视化表格编辑区 -->
      <div v-show="activeTab === 'visual'" class="tabContent visualTab">
        <!-- 控制栏 -->
        <div class="configBar">
          <div class="configRow basicSettings">
            <div class="configItem">
              <span class="label">行数:</span>
              <el-input-number
                v-model="rowCount"
                :min="1"
                :max="50"
                size="mini"
                @change="onRowCountChange"
              ></el-input-number>
            </div>
            <div class="configItem">
              <span class="label">列数:</span>
              <el-input-number
                v-model="colCount"
                :min="1"
                :max="20"
                size="mini"
                @change="onColCountChange"
              ></el-input-number>
            </div>
            <div class="configItem">
              <el-checkbox v-model="hasHeader" @change="onHeaderToggle">首行作为表头</el-checkbox>
            </div>
            <div class="configItem alignItem">
              <span class="label">当前列对齐:</span>
              <el-button-group size="mini">
                <el-button
                  size="mini"
                  :type="currentColAlign === 'left' ? 'primary' : 'default'"
                  icon="el-icon-back"
                  title="左对齐"
                  @click="setCurrentColAlign('left')"
                ></el-button>
                <el-button
                  size="mini"
                  :type="currentColAlign === 'center' ? 'primary' : 'default'"
                  title="居中对齐"
                  @click="setCurrentColAlign('center')"
                >居中</el-button>
                <el-button
                  size="mini"
                  :type="currentColAlign === 'right' ? 'primary' : 'default'"
                  icon="el-icon-right"
                  title="右对齐"
                  @click="setCurrentColAlign('right')"
                ></el-button>
              </el-button-group>
            </div>
          </div>

          <!-- 精准单元格与行列快捷操作 -->
          <div class="configRow actionButtons">
            <div class="actionGroup">
              <span class="groupTitle">行列操作:</span>
              <el-button size="mini" @click="insertRowAbove" title="在当前选中行上方插入一行">上插行</el-button>
              <el-button size="mini" @click="insertRowBelow" title="在当前选中行下方插入一行">下插行</el-button>
              <el-button size="mini" type="danger" plain :disabled="rowCount <= 1" @click="deleteCurrentRow" title="删除当前选中行">删此行</el-button>
              <el-button size="mini" @click="insertColLeft" title="在当前选中列左侧插入一列">左插列</el-button>
              <el-button size="mini" @click="insertColRight" title="在当前选中列右侧插入一列">右插列</el-button>
              <el-button size="mini" type="danger" plain :disabled="colCount <= 1" @click="deleteCurrentCol" title="删除当前选中列">删此列</el-button>
            </div>

            <div class="actionGroup endGroup">
              <el-button size="mini" icon="el-icon-document-copy" @click="copyAsMarkdown" title="将当前表格复制为 Markdown 格式">复制 MD</el-button>
              <el-button size="mini" icon="el-icon-document-copy" @click="copyAsCsv" title="将当前表格复制为 CSV 格式">复制 CSV</el-button>
              <el-button size="mini" type="text" @click="clearData">清空内容</el-button>
              <el-button
                v-if="isEditing"
                size="mini"
                type="text"
                class="dangerText"
                @click="removeTable"
              >移除表格</el-button>
            </div>
          </div>
        </div>

        <!-- 表格编辑区 -->
        <div class="gridWrapper customScrollbar" ref="gridWrapper">
          <table class="gridTable">
            <thead>
              <tr class="colHeaderRow">
                <th class="cornerCell">#</th>
                <th
                  v-for="(col, cIndex) in colCount"
                  :key="'col_header_' + cIndex"
                  class="colHeaderCell"
                  :class="{ isActiveCol: currentActiveCol === cIndex }"
                  @click="currentActiveCol = cIndex"
                >
                  <div class="colHeaderInner">
                    <span>列 {{ cIndex + 1 }}</span>
                    <span class="alignTag">({{ getAlignText(alignments[cIndex]) }})</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rIndex) in matrix"
                :key="rIndex"
                :class="{ isActiveRow: currentActiveRow === rIndex }"
              >
                <td class="rowHeaderCell" @click="currentActiveRow = rIndex">
                  {{ hasHeader && rIndex === 0 ? '表头' : rIndex + (hasHeader ? 0 : 1) }}
                </td>
                <td
                  v-for="(cell, cIndex) in row"
                  :key="cIndex"
                  :class="{
                    isHeaderCell: hasHeader && rIndex === 0,
                    isActiveCell: currentActiveRow === rIndex && currentActiveCol === cIndex
                  }"
                  :style="{ textAlign: alignments[cIndex] || 'left' }"
                  @click="onCellClick(rIndex, cIndex)"
                >
                  <input
                    :ref="'cell_' + rIndex + '_' + cIndex"
                    v-model="matrix[rIndex][cIndex]"
                    class="cellInput"
                    :style="{ textAlign: alignments[cIndex] || 'left' }"
                    :placeholder="hasHeader && rIndex === 0 ? '表头标题' : ''"
                    @focus="onCellFocus(rIndex, cIndex)"
                    @keydown.enter.exact.prevent="onEnterKey(rIndex, cIndex)"
                    @keydown.tab.prevent="onTabKey(rIndex, cIndex, $event)"
                    @keydown.up.prevent="onArrowKey(rIndex, cIndex, 'up')"
                    @keydown.down.prevent="onArrowKey(rIndex, cIndex, 'down')"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="hintBar">
          <span>💡 <b>Tab</b> 切换单元格（末尾按 Tab 自动增行）；<b>Enter</b> 切至下一行；<b>Shift + Tab</b> 向前跳转；支持上下方向键导航。</span>
        </div>
      </div>

      <!-- Tab 2: Markdown 源码模式 (Logseq 纯文本兼容) -->
      <div v-show="activeTab === 'markdown'" class="tabContent markdownTab">
        <div class="mdNotice">
          支持直接编辑或粘贴 Logseq / GitHub Markdown 表格语法，实时双向同步：
        </div>
        <el-input
          type="textarea"
          v-model="markdownSource"
          :rows="12"
          class="mdTextarea"
          placeholder="| 列 1 | 列 2 | 列 3 |&#10;| :--- | :---: | ---: |&#10;| 数据 1 | 数据 2 | 数据 3 |"
          @input="onMarkdownSourceInput"
        ></el-input>
        <div class="mdActions">
          <el-button size="small" type="primary" plain @click="applyMarkdownToMatrix">解析并同步到可视化设计</el-button>
          <el-button size="small" icon="el-icon-document-copy" @click="copyAsMarkdown">复制 Markdown 文本</el-button>
        </div>
      </div>

      <!-- Tab 3: 快速导入模式 (Excel / WPS / CSV / TSV) -->
      <div v-show="activeTab === 'import'" class="tabContent importTab">
        <div class="importNotice">
          从 <b>Excel</b>、<b>WPS</b>、<b>Google Sheets</b> 或 <b>Logseq</b> 复制整块表格后，直接粘贴到下方即可一键解析：
        </div>
        <el-input
          type="textarea"
          v-model="rawPasteText"
          :rows="10"
          class="importTextarea"
          placeholder="在此处直接 Ctrl + V 粘贴表格内容（支持 Tab 分隔的 Excel 数据、CSV 或 Markdown 表格）..."
        ></el-input>
        <div class="importActions">
          <el-button size="small" type="primary" icon="el-icon-check" @click="parseAndImport">解析并导入为表格</el-button>
          <el-button size="small" @click="rawPasteText = ''">清空粘贴区</el-button>
        </div>
      </div>

      <!-- 后置文字 -->
      <div class="nodeTitleRow" v-if="activeTab !== 'import'">
        <span class="label">后置文字（表格下方附注/总结）:</span>
        <el-input
          v-model="postfixText"
          size="small"
          placeholder="可在此输入表格下方的总结或备注（可选）"
        ></el-input>
      </div>
    </div>

    <div slot="footer" class="dialog-footer">
      <el-button size="small" @click="visible = false">取消</el-button>
      <el-button size="small" type="primary" @click="confirm">确定保存</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { mapState } from 'vuex'
import {
  escapeHtml,
  isMarkdownTable,
  markdownTableToMatrix,
  matrixToMarkdownTable,
  htmlTableToMatrix,
  matrixToHtmlTable,
  csvOrTsvToMatrix
} from 'simple-mind-map/src/utils/table'

export default {
  name: 'NodeTableDialog',
  props: {
    mindMap: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      visible: false,
      isEditing: false,
      activeNode: null,
      activeTab: 'visual',
      rowCount: 3,
      colCount: 3,
      hasHeader: true,
      matrix: [],
      alignments: ['left', 'left', 'left'],
      currentActiveRow: 0,
      currentActiveCol: 0,
      prefixText: '',
      postfixText: '',
      markdownSource: '',
      rawPasteText: ''
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    }),
    currentColAlign() {
      return this.alignments[this.currentActiveCol] || 'left'
    }
  },
  created() {
    this.$bus.$on('showNodeTable', this.open)
    if (this.mindMap) {
      this.mindMap.on('show_node_table', this.open)
    }
  },
  watch: {
    mindMap(newVal, oldVal) {
      if (oldVal) oldVal.off('show_node_table', this.open)
      if (newVal) newVal.on('show_node_table', this.open)
    }
  },
  beforeDestroy() {
    this.$bus.$off('showNodeTable', this.open)
    if (this.mindMap) {
      this.mindMap.off('show_node_table', this.open)
    }
  },
  methods: {
    open(targetNode) {
      const node =
        targetNode ||
        (this.mindMap &&
          this.mindMap.renderer &&
          this.mindMap.renderer.activeNodeList &&
          this.mindMap.renderer.activeNodeList[0])
      if (!node) {
        this.$message.warning('请先选中一个节点')
        return
      }
      this.activeNode = node
      this.activeTab = 'visual'
      this.parseNodeContent(node)
      this.visible = true
    },

    onDialogOpened() {
      this.$nextTick(() => {
        this.focusCell(0, 0)
      })
    },

    parseNodeContent(node) {
      const text = String(node.getData('text') || '')

      // 1. 尝试解析 HTML <table>
      if (/<table[\s>]/i.test(text)) {
        this.isEditing = true
        const parsed = htmlTableToMatrix(text)
        if (parsed.matrix && parsed.matrix.length > 0) {
          this.matrix = parsed.matrix
          this.alignments = parsed.alignments || []
          this.rowCount = parsed.matrix.length
          this.colCount = parsed.matrix[0].length
          this.hasHeader = parsed.hasHeader
          this.prefixText = this.cleanWrapperTags(parsed.prefixText)
          this.postfixText = this.cleanWrapperTags(parsed.postfixText)
          this.syncToMarkdown()
          return
        }
      }

      // 2. 尝试解析 Markdown 表格
      if (isMarkdownTable(text)) {
        this.isEditing = true
        const parsed = markdownTableToMatrix(text)
        if (parsed.matrix && parsed.matrix.length > 0) {
          this.matrix = parsed.matrix
          this.alignments = parsed.alignments || []
          this.rowCount = parsed.matrix.length
          this.colCount = parsed.matrix[0].length
          this.hasHeader = parsed.hasHeader
          this.prefixText = parsed.prefixText || ''
          this.postfixText = parsed.postfixText || ''
          this.syncToMarkdown()
          return
        }
      }

      // 3. 无表格，初始化默认 3x3 模板
      this.isEditing = false
      this.prefixText = this.cleanWrapperTags(text)
      this.postfixText = ''
      this.rowCount = 3
      this.colCount = 3
      this.hasHeader = true
      this.alignments = ['left', 'left', 'left']
      this.initMatrix(3, 3)
      this.syncToMarkdown()
    },

    cleanWrapperTags(html) {
      if (!html) return ''
      let res = html.trim()
      if (res === '<p><br></p>') return ''
      // 去除最外层包裹的单个 p 标签
      if (res.startsWith('<p>') && res.endsWith('</p>') && (res.match(/<p>/g) || []).length === 1) {
        res = res.slice(3, -4)
      }
      return res.replace(/<br\s*\/?>/gi, '\n')
    },

    initMatrix(rows, cols) {
      const mat = []
      for (let r = 0; r < rows; r++) {
        const row = []
        for (let c = 0; c < cols; c++) {
          if (r === 0 && this.hasHeader) {
            row.push(`列 ${c + 1}`)
          } else {
            row.push('')
          }
        }
        mat.push(row)
      }
      this.matrix = mat
      while (this.alignments.length < cols) {
        this.alignments.push('left')
      }
    },

    onHeaderToggle() {
      this.syncToMarkdown()
    },

    onRowCountChange(newVal) {
      const cur = this.matrix.length
      if (newVal > cur) {
        for (let i = cur; i < newVal; i++) {
          this.matrix.push(new Array(this.colCount).fill(''))
        }
      } else if (newVal < cur) {
        this.matrix = this.matrix.slice(0, newVal)
      }
      this.syncToMarkdown()
    },

    onColCountChange(newVal) {
      const cur = this.colCount
      this.matrix.forEach(row => {
        if (newVal > cur) {
          for (let i = cur; i < newVal; i++) {
            row.push('')
          }
        } else if (newVal < cur) {
          row.splice(newVal)
        }
      })
      while (this.alignments.length < newVal) {
        this.alignments.push('left')
      }
      if (this.alignments.length > newVal) {
        this.alignments = this.alignments.slice(0, newVal)
      }
      this.syncToMarkdown()
    },

    onCellClick(r, c) {
      this.currentActiveRow = r
      this.currentActiveCol = c
    },

    onCellFocus(r, c) {
      this.currentActiveRow = r
      this.currentActiveCol = c
    },

    setCurrentColAlign(align) {
      const col = this.currentActiveCol
      this.$set(this.alignments, col, align)
      this.syncToMarkdown()
    },

    getAlignText(align) {
      if (align === 'center') return '居中'
      if (align === 'right') return '右'
      return '左'
    },

    // 向上插入行
    insertRowAbove() {
      const r = this.currentActiveRow
      const newRow = new Array(this.colCount).fill('')
      this.matrix.splice(r, 0, newRow)
      this.rowCount = this.matrix.length
      this.syncToMarkdown()
      this.$nextTick(() => this.focusCell(r, this.currentActiveCol))
    },

    // 向下插入行
    insertRowBelow() {
      const r = this.currentActiveRow + 1
      const newRow = new Array(this.colCount).fill('')
      this.matrix.splice(r, 0, newRow)
      this.rowCount = this.matrix.length
      this.currentActiveRow = r
      this.syncToMarkdown()
      this.$nextTick(() => this.focusCell(r, this.currentActiveCol))
    },

    // 删除当前行
    deleteCurrentRow() {
      if (this.rowCount <= 1) return
      this.matrix.splice(this.currentActiveRow, 1)
      this.rowCount = this.matrix.length
      if (this.currentActiveRow >= this.rowCount) {
        this.currentActiveRow = this.rowCount - 1
      }
      this.syncToMarkdown()
      this.$nextTick(() => this.focusCell(this.currentActiveRow, this.currentActiveCol))
    },

    // 向左插入列
    insertColLeft() {
      const c = this.currentActiveCol
      this.matrix.forEach((row, idx) => {
        row.splice(c, 0, idx === 0 && this.hasHeader ? `列 ${c + 1}` : '')
      })
      this.alignments.splice(c, 0, 'left')
      this.colCount = this.matrix[0].length
      this.syncToMarkdown()
      this.$nextTick(() => this.focusCell(this.currentActiveRow, c))
    },

    // 向右插入列
    insertColRight() {
      const c = this.currentActiveCol + 1
      this.matrix.forEach((row, idx) => {
        row.splice(c, 0, idx === 0 && this.hasHeader ? `列 ${c + 1}` : '')
      })
      this.alignments.splice(c, 0, 'left')
      this.colCount = this.matrix[0].length
      this.currentActiveCol = c
      this.syncToMarkdown()
      this.$nextTick(() => this.focusCell(this.currentActiveRow, c))
    },

    // 删除当前列
    deleteCurrentCol() {
      if (this.colCount <= 1) return
      const c = this.currentActiveCol
      this.matrix.forEach(row => {
        row.splice(c, 1)
      })
      this.alignments.splice(c, 1)
      this.colCount = this.matrix[0].length
      if (this.currentActiveCol >= this.colCount) {
        this.currentActiveCol = this.colCount - 1
      }
      this.syncToMarkdown()
      this.$nextTick(() => this.focusCell(this.currentActiveRow, this.currentActiveCol))
    },

    clearData() {
      this.matrix.forEach(row => {
        for (let i = 0; i < row.length; i++) {
          row[i] = ''
        }
      })
      this.syncToMarkdown()
    },

    focusCell(r, c) {
      const target = this.$refs[`cell_${r}_${c}`]
      if (target && target[0]) {
        target[0].focus()
      }
    },

    onEnterKey(r, c) {
      if (r < this.rowCount - 1) {
        this.focusCell(r + 1, c)
      } else {
        this.insertRowBelow()
      }
    },

    onTabKey(r, c, event) {
      if (event.shiftKey) {
        if (c > 0) {
          this.focusCell(r, c - 1)
        } else if (r > 0) {
          this.focusCell(r - 1, this.colCount - 1)
        }
        return
      }
      if (c < this.colCount - 1) {
        this.focusCell(r, c + 1)
      } else if (r < this.rowCount - 1) {
        this.focusCell(r + 1, 0)
      } else {
        // 最后一个单元格按 Tab，自动加行
        this.insertRowBelow()
        this.$nextTick(() => {
          this.focusCell(r + 1, 0)
        })
      }
    },

    onArrowKey(r, c, dir) {
      if (dir === 'up' && r > 0) {
        this.focusCell(r - 1, c)
      } else if (dir === 'down' && r < this.rowCount - 1) {
        this.focusCell(r + 1, c)
      }
    },

    syncToMarkdown() {
      this.markdownSource = matrixToMarkdownTable({
        matrix: this.matrix,
        alignments: this.alignments,
        hasHeader: this.hasHeader
      })
    },

    onMarkdownSourceInput(val) {
      // 源码修改时保留
    },

    applyMarkdownToMatrix() {
      if (!isMarkdownTable(this.markdownSource)) {
        this.$message.warning('未检测到有效的 Markdown 表格格式')
        return
      }
      const parsed = markdownTableToMatrix(this.markdownSource)
      if (parsed.matrix && parsed.matrix.length > 0) {
        this.matrix = parsed.matrix
        this.alignments = parsed.alignments || []
        this.rowCount = parsed.matrix.length
        this.colCount = parsed.matrix[0].length
        this.hasHeader = parsed.hasHeader
        this.activeTab = 'visual'
        this.$message.success('已成功解析 Markdown 表格并载入网格')
      }
    },

    parseAndImport() {
      if (!this.rawPasteText || !this.rawPasteText.trim()) {
        this.$message.warning('请先在输入框中粘贴内容')
        return
      }
      const parsed = csvOrTsvToMatrix(this.rawPasteText)
      if (!parsed.matrix || parsed.matrix.length === 0) {
        this.$message.error('无法解析该格式，请确认粘贴的是 Excel 或 CSV 数据')
        return
      }
      this.matrix = parsed.matrix
      this.alignments = parsed.alignments || new Array(parsed.matrix[0].length).fill('left')
      this.rowCount = parsed.matrix.length
      this.colCount = parsed.matrix[0].length
      this.hasHeader = parsed.hasHeader !== false
      this.syncToMarkdown()
      this.activeTab = 'visual'
      this.$message.success(`成功导入 ${this.rowCount} 行 ${this.colCount} 列表格！`)
    },

    onTabChange(tab) {
      if (tab.name === 'markdown') {
        this.syncToMarkdown()
      } else if (tab.name === 'visual' && this.activeTab === 'markdown') {
        if (isMarkdownTable(this.markdownSource)) {
          const parsed = markdownTableToMatrix(this.markdownSource)
          if (parsed.matrix && parsed.matrix.length > 0) {
            this.matrix = parsed.matrix
            this.alignments = parsed.alignments || []
            this.rowCount = parsed.matrix.length
            this.colCount = parsed.matrix[0].length
          }
        }
      }
    },

    copyAsMarkdown() {
      this.syncToMarkdown()
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.markdownSource)
        this.$message.success('已复制 Markdown 表格到剪贴板！')
      } else {
        this.$message.info('当前环境不支持直接复制，请在 Markdown 选项卡中手动复制')
      }
    },

    copyAsCsv() {
      const csv = this.matrix
        .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(csv)
        this.$message.success('已复制 CSV 文本到剪贴板！')
      } else {
        this.$message.info('当前环境不支持直接复制')
      }
    },

    removeTable() {
      this.$confirm('确定要从该节点中移除表格吗？', '提示', {
        type: 'warning'
      })
        .then(() => {
          const combined = (this.prefixText + (this.postfixText ? '\n' + this.postfixText : '')).trim() || '新建主题'
          this.applyTextToNode(escapeHtml(combined).replace(/\n/g, '<br>'))
          this.visible = false
          this.$message.success('已移除表格')
        })
        .catch(() => {})
    },

    buildFinalHtml() {
      if (this.activeTab === 'markdown' && isMarkdownTable(this.markdownSource)) {
        const parsed = markdownTableToMatrix(this.markdownSource)
        if (parsed.matrix && parsed.matrix.length > 0) {
          this.matrix = parsed.matrix
          this.alignments = parsed.alignments || []
          this.hasHeader = parsed.hasHeader
        }
      }

      const tableHtml = matrixToHtmlTable({
        matrix: this.matrix,
        alignments: this.alignments,
        hasHeader: this.hasHeader,
        className: 'smm-node-table'
      })

      let finalHtml = ''
      const prefix = this.prefixText.trim()
      const postfix = this.postfixText.trim()

      if (prefix) {
        finalHtml += `<p>${escapeHtml(prefix).replace(/\n/g, '<br>')}</p>`
      }
      finalHtml += tableHtml
      if (postfix) {
        finalHtml += `<p>${escapeHtml(postfix).replace(/\n/g, '<br>')}</p>`
      }

      return finalHtml
    },

    applyTextToNode(finalText) {
      if (!this.activeNode) return
      // 开启富文本模式
      if (this.mindMap && !this.mindMap.opt.openNodeRichText) {
        this.$bus.$emit('toggleOpenNodeRichText', true)
      }
      // 注意：必须使用 resetRichText = false，防止简单样式重置时销毁表格 DOM 结构！
      this.mindMap.execCommand('SET_NODE_TEXT', this.activeNode, finalText, true, false)
      this.activeNode.setData({ richText: true, text: finalText })
      this.mindMap.render()
    },

    confirm() {
      const finalText = this.buildFinalHtml()
      this.applyTextToNode(finalText)
      this.visible = false
      this.$message.success(this.isEditing ? '表格已更新' : '表格已插入')
    }
  }
}
</script>

<style lang="less" scoped>
.tableDialogPanel {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &.isDark {
    color: #cfd3dc;

    .nodeTitleRow .label {
      color: #cfd3dc;
    }

    .configBar {
      border-color: #363b3f;
      background-color: #1e2025;
    }

    .gridTable {
      border-color: #4c4d4f;

      th.cornerCell,
      th.colHeaderCell,
      td.rowHeaderCell {
        background-color: #2b2f3a;
        color: #a3a6ad;
        border-color: #4c4d4f;
      }

      td {
        border-color: #4c4d4f;

        &.isHeaderCell {
          background-color: #2b3340;
        }

        &.isActiveCell {
          background-color: rgba(64, 158, 255, 0.15);
        }

        .cellInput {
          background-color: transparent;
          color: #cfd3dc;
        }
      }
    }

    .hintBar {
      color: #8d9095;
    }

    .mdTextarea /deep/ textarea,
    .importTextarea /deep/ textarea {
      background-color: #1e2025;
      color: #cfd3dc;
      border-color: #4c4d4f;
    }
  }

  .nodeTitleRow {
    display: flex;
    align-items: center;
    gap: 8px;

    .label {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      color: #606266;
    }
  }

  .tabContent {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .configBar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background-color: #f8f9fb;
    border: 1px solid #ebeef5;
    border-radius: 6px;

    .configRow {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

      &.actionButtons {
        border-top: 1px dashed #e4e7ed;
        padding-top: 8px;
      }

      .configItem {
        display: flex;
        align-items: center;
        gap: 6px;

        .label {
          font-size: 13px;
          white-space: nowrap;
        }
      }

      .actionGroup {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;

        .groupTitle {
          font-size: 12px;
          color: #909399;
          margin-right: 2px;
        }

        &.endGroup {
          margin-left: auto;
        }
      }

      .dangerText {
        color: #f56c6c;
      }
    }
  }

  .gridWrapper {
    max-height: 360px;
    overflow: auto;
    border: 1px solid #dcdfe6;
    border-radius: 6px;
    background: #fff;

    .isDark & {
      background: #18191c;
      border-color: #4c4d4f;
    }
  }

  .gridTable {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;

    th.cornerCell,
    th.colHeaderCell,
    td.rowHeaderCell {
      background-color: #f2f3f5;
      color: #606266;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      border: 1px solid #e4e7ed;
      user-select: none;
    }

    th.cornerCell {
      width: 42px;
      padding: 4px;
    }

    th.colHeaderCell {
      padding: 4px 6px;
      cursor: pointer;

      &.isActiveCol {
        background-color: #e0edfe;
        color: #409eff;
      }

      .colHeaderInner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;

        .alignTag {
          font-size: 10px;
          opacity: 0.7;
        }
      }
    }

    td.rowHeaderCell {
      width: 42px;
      padding: 4px;
      cursor: pointer;
    }

    td {
      border: 1px solid #e4e7ed;
      padding: 0;
      position: relative;

      &.isHeaderCell {
        background-color: #f7f9fc;
        font-weight: bold;
      }

      &.isActiveCell {
        background-color: #edf5ff;
      }

      .cellInput {
        width: 100%;
        box-sizing: border-box;
        border: none;
        outline: none;
        padding: 6px 8px;
        font-size: 13px;
        background: transparent;

        &:focus {
          box-shadow: inset 0 0 0 2px #409eff;
        }
      }
    }
  }

  .hintBar {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
  }

  .markdownTab,
  .importTab {
    .mdNotice,
    .importNotice {
      font-size: 13px;
      color: #606266;
      line-height: 1.5;
    }

    .mdTextarea /deep/ textarea,
    .importTextarea /deep/ textarea {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
    }

    .mdActions,
    .importActions {
      display: flex;
      gap: 10px;
      margin-top: 4px;
    }
  }
}
</style>
