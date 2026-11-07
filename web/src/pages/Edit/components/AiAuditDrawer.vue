<template>
  <el-drawer
    title="🔍 AI 思维导图学术体检与纠错诊断"
    :visible.sync="visible"
    direction="rtl"
    size="460px"
    :append-to-body="true"
    custom-class="aiAuditDrawer"
  >
    <div class="drawerContent" v-loading="loading" element-loading-text="AI 导师正在严查导图逻辑与事实硬伤...">
      <!-- 顶部操作栏 -->
      <div class="actionHeader">
        <div class="descTip">
          <strong>【审校铁律】</strong>：严禁 AI 代写子节点！本系统仅定位病因并抛出反思自查问题，引导您自主思考与重构。
        </div>
        <div class="btnRow">
          <el-button type="primary" size="small" icon="el-icon-cpu" @click="startAudit(false)" :disabled="loading">
            体检整张导图
          </el-button>
          <el-button size="small" icon="el-icon-connection" @click="startAudit(true)" :disabled="loading || !hasSelectedNode">
            体检当前分支
          </el-button>
        </div>
      </div>

      <!-- 诊断概要卡片 -->
      <div v-if="report" class="summaryBox">
        <div class="scoreRow">
          <div class="scoreLabel">逻辑健康度：</div>
          <el-progress
            :percentage="report.score || 0"
            :color="getScoreColor(report.score)"
            :stroke-width="12"
            style="flex: 1; margin: 0 12px;"
          ></el-progress>
          <div class="scoreVal" :style="{ color: getScoreColor(report.score) }">{{ report.score }} 分</div>
        </div>
        <div class="summaryText">
          {{ report.summary }}
        </div>
      </div>

      <!-- 诊断清单 -->
      <div v-if="report && report.issues" class="issuesContainer">
        <div class="issuesTitle">
          <span>发现 {{ report.issues.length }} 处待推敲节点：</span>
          <span class="subHint">（点击卡片即可在导图中穿梭定位）</span>
        </div>

        <div v-if="report.issues.length === 0" class="emptySuccess">
          🎉 恭喜！当前导图逻辑极其严密，未发现明显事实硬伤与层级倒置！
        </div>

        <div
          v-for="(issue, index) in report.issues"
          :key="index"
          class="issueCard"
          :class="issue.severity ? issue.severity.toLowerCase() : 'warning'"
          @click="locateNode(issue)"
        >
          <div class="cardHeader">
            <el-tag size="mini" :type="getTagType(issue.severity)">
              {{ getSeverityName(issue.severity) }}
            </el-tag>
            <el-tag size="mini" type="info" style="margin-left: 6px;">
              {{ getCategoryName(issue.category) }}
            </el-tag>
            <span class="nodeTargetName">📌 {{ issue.node_text || '未命名前缀' }}</span>
          </div>

          <div class="critiqueText">
            <strong>【诊断病因】</strong>：{{ issue.critique }}
          </div>

          <div class="socraticBox">
            <span class="socraticIcon">💡</span>
            <div class="socraticText">
              <strong>【启发自查】</strong>：{{ issue.socratic_question }}
            </div>
          </div>
        </div>
      </div>

      <!-- 底部 Gemini 关联通道引导 -->
      <div class="bottomMcpTip">
        <div class="tipTitle">💡 想要在 Google Gemini 中直接对话审校？</div>
        <div class="tipSub">双击运行项目根目录的 <code>启动Gemini关联.bat</code>，即可在 Gemini 网页端关联您的本地导图！</div>
      </div>
    </div>
  </el-drawer>
</template>

<script>
import { auditMindMap } from '@/review/mindMapAuditor'

export default {
  name: 'AiAuditDrawer',
  props: {
    mindMap: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      visible: false,
      loading: false,
      report: null
    }
  },
  created() {
    this.$bus.$on('showAiAudit', () => {
      this.show()
    })
  },
  beforeDestroy() {
    this.$bus.$off('showAiAudit')
  },
  computed: {
    hasSelectedNode() {
      if (!this.mindMap || !this.mindMap.renderer) return false
      const list = this.mindMap.renderer.activeNodeList || []
      return list.length > 0
    }
  },
  methods: {
    show() {
      this.visible = true
      if (!this.report) {
        this.startAudit(false)
      }
    },
    async startAudit(onlyBranch = false) {
      if (!this.mindMap) {
        this.$message.warning('思维导图未就绪')
        return
      }

      let focusNodeId = null
      if (onlyBranch) {
        const activeList = this.mindMap.renderer.activeNodeList || []
        if (activeList.length > 0) {
          focusNodeId = activeList[0].nodeData.data.uid || activeList[0].nodeData.data.id
        }
      }

      const rootData = this.mindMap.getData(false)
      if (!rootData || !rootData.root) {
        this.$message.warning('思维导图内容为空')
        return
      }

      this.loading = true
      try {
        const res = await auditMindMap(rootData.root, { focusNodeId })
        this.report = res
        this.$message.success('导图学术体检完成！')
      } catch (err) {
        this.$message.error(err.message || '体检过程中发生错误')
      } finally {
        this.loading = false
      }
    },
    locateNode(issue) {
      if (!this.mindMap || !issue) return
      let targetNode = null

      // 1. 尝试按 node_id 匹配
      if (issue.node_id) {
        targetNode = this.mindMap.renderer.findNodeByData({ uid: issue.node_id })
        if (!targetNode) {
          targetNode = this.mindMap.renderer.findNodeByData({ id: issue.node_id })
        }
      }

      // 2. 尝试按节点文字精准匹配
      if (!targetNode && issue.node_text) {
        const allNodes = this.mindMap.renderer.root ? [this.mindMap.renderer.root] : []
        const queue = [...allNodes]
        while (queue.length > 0) {
          const curr = queue.shift()
          const text = (curr.nodeData.data.text || '').replace(/<[^>]+>/g, '').trim()
          if (text === issue.node_text.trim()) {
            targetNode = curr
            break
          }
          if (curr.children) queue.push(...curr.children)
        }
      }

      if (targetNode) {
        this.mindMap.renderer.activeNodeList = [targetNode]
        this.mindMap.render()
        if (this.mindMap.view && this.mindMap.view.locate) {
          this.mindMap.view.locate(targetNode)
        }
        this.$message.info(`已在画布中居中定位节点：【${issue.node_text}】`)
      } else {
        this.$message.warning(`未能定位到节点：${issue.node_text}`)
      }
    },
    getScoreColor(score) {
      if (score >= 85) return '#67c23a'
      if (score >= 60) return '#e6a23c'
      return '#f56c6c'
    },
    getTagType(severity) {
      const s = (severity || '').toUpperCase()
      if (s === 'CRITICAL') return 'danger'
      if (s === 'WARNING') return 'warning'
      return 'info'
    },
    getSeverityName(severity) {
      const s = (severity || '').toUpperCase()
      if (s === 'CRITICAL') return '严重硬伤'
      if (s === 'WARNING') return '逻辑瑕疵'
      return '优化建议'
    },
    getCategoryName(cat) {
      const map = {
        FACTUAL_ERROR: '科学事实硬伤',
        HIERARCHY_INVERSION: '层级倒置/越级',
        MISSING_PREREQUISITE: '前提条件断层',
        CONFUSION_RISK: '易混概念伪等价'
      }
      return map[cat] || '逻辑问题'
    }
  }
}
</script>

<style lang="less" scoped>
.drawerContent {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;

  .actionHeader {
    background: #fdf6ec;
    border: 1px solid #faecd8;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;

    .descTip {
      font-size: 13px;
      color: #e6a23c;
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .btnRow {
      display: flex;
      gap: 10px;
    }
  }

  .summaryBox {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    padding: 14px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

    .scoreRow {
      display: flex;
      align-items: center;
      margin-bottom: 10px;

      .scoreLabel {
        font-size: 14px;
        font-weight: bold;
        color: #303133;
      }

      .scoreVal {
        font-size: 16px;
        font-weight: bold;
      }
    }

    .summaryText {
      font-size: 13px;
      color: #606266;
      line-height: 1.5;
    }
  }

  .issuesContainer {
    .issuesTitle {
      font-size: 14px;
      font-weight: bold;
      color: #303133;
      margin-bottom: 12px;

      .subHint {
        font-size: 12px;
        font-weight: normal;
        color: #909399;
      }
    }

    .emptySuccess {
      padding: 20px;
      text-align: center;
      color: #67c23a;
      background: #f0f9eb;
      border-radius: 6px;
      font-size: 14px;
    }

    .issueCard {
      background: #fff;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      &.critical {
        border-left: 4px solid #f56c6c;
      }

      &.warning {
        border-left: 4px solid #e6a23c;
      }

      &.suggestion {
        border-left: 4px solid #909399;
      }

      .cardHeader {
        display: flex;
        align-items: center;
        margin-bottom: 8px;

        .nodeTargetName {
          font-weight: bold;
          font-size: 14px;
          color: #303133;
          margin-left: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .critiqueText {
        font-size: 13px;
        color: #606266;
        line-height: 1.5;
        margin-bottom: 8px;
      }

      .socraticBox {
        background: #f4f4f5;
        border-radius: 4px;
        padding: 8px 10px;
        display: flex;
        gap: 6px;

        .socraticIcon {
          font-size: 15px;
        }

        .socraticText {
          font-size: 12px;
          color: #409eff;
          line-height: 1.5;
        }
      }
    }
  }

  .bottomMcpTip {
    margin-top: 24px;
    background: #ecf5ff;
    border: 1px dashed #b3d8ff;
    border-radius: 6px;
    padding: 12px;

    .tipTitle {
      font-size: 13px;
      font-weight: bold;
      color: #409eff;
      margin-bottom: 4px;
    }

    .tipSub {
      font-size: 12px;
      color: #606266;
      line-height: 1.5;

      code {
        background: #fff;
        padding: 2px 4px;
        border-radius: 3px;
        color: #e6a23c;
      }
    }
  }
}
</style>
