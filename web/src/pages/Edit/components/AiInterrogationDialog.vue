<template>
  <el-dialog
    title="🧠 AI 深度拷问系统"
    :visible.sync="visible"
    width="760px"
    :append-to-body="true"
    custom-class="aiInterrogationDialog"
  >
    <div class="dialogBody" v-loading="loading" :element-loading-text="loadingText">
      <!-- ================= 阶段 0：前置选择模式与考查节点 ================= -->
      <div v-if="viewState === 'setup'" class="setupContainer">
        <!-- 1. 选择考查节点 -->
        <div class="setupSection">
          <div class="sectionTitle">
            <span class="icon">🎯</span>
            <span class="text">第 1 步：选择考查节点与知识范围</span>
          </div>

          <div class="scopeToggle">
            <el-radio-group v-model="targetScope" size="small" @change="onScopeChange">
              <el-radio-button label="node">📍 靶向指定节点及子分支</el-radio-button>
              <el-radio-button label="all">🌐 全图宏观知识网络</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="targetScope === 'node'" class="nodeSelectBox">
            <div class="selectorRow">
              <span class="label">选择目标节点：</span>
              <el-select
                v-model="focusNodeId"
                placeholder="请选择思维导图节点"
                size="small"
                filterable
                style="flex: 1;"
                @change="onNodeSelectChange"
              >
                <el-option
                  v-for="item in allMapNodes"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                >
                  <span style="float: left">{{ item.label }}</span>
                  <span style="float: right; color: #8492a6; font-size: 12px">
                    {{ item.childrenCount ? item.childrenCount + ' 个子节点' : '叶子节点' }}
                  </span>
                </el-option>
              </el-select>
            </div>

            <!-- 当前选中节点的详细预览卡片 -->
            <div v-if="selectedNodeSummary" class="nodePreviewCard">
              <div class="cardTop">
                <strong class="nodeName">📌 目标：【{{ selectedNodeSummary.text }}】</strong>
                <el-tag size="mini" type="info">{{ selectedNodeSummary.childrenCount }} 个子节点</el-tag>
              </div>
              <div class="nodePath" v-if="selectedNodeSummary.fullPath">
                <span class="pathLabel">层级链路：</span>{{ selectedNodeSummary.fullPath }}
              </div>
              <div class="subChildrenPreview" v-if="selectedNodeSummary.previewChildren && selectedNodeSummary.previewChildren.length">
                <span class="previewLabel">包含子分支：</span>
                <el-tag
                  v-for="(child, idx) in selectedNodeSummary.previewChildren"
                  :key="idx"
                  size="mini"
                  class="childTag"
                >
                  {{ child }}
                </el-tag>
                <span v-if="selectedNodeSummary.childrenCount > 6" class="moreTag">...等共 {{ selectedNodeSummary.childrenCount }} 个</span>
              </div>
            </div>
          </div>

          <div v-else class="allMapTip">
            <el-alert
              title="已选择考查整张思维导图：AI 将宏观扫描全图知识结构并进行跨分支提问。"
              type="info"
              :closable="false"
              show-icon
            />
          </div>
        </div>

        <!-- 2. 选择拷问模式 -->
        <div class="setupSection">
          <div class="sectionTitle">
            <span class="icon">🧩</span>
            <span class="text">第 2 步：选择拷问模式</span>
          </div>

          <div class="modeCardsGrid">
            <!-- 模式 1：内容记忆 -->
            <div
              class="modeCard"
              :class="{ active: selectedMode === 'memory' }"
              @click="selectedMode = 'memory'"
            >
              <div class="cardBadge">注重理解促记忆</div>
              <div class="cardHeader">
                <span class="modeIcon">📖</span>
                <span class="modeName">内容记忆模式</span>
              </div>
              <p class="modeDesc">
                帮我记忆内容：英语作文素材/高级句型、语文古诗文名句默写、各学科核心背诵考点。
              </p>
              <div class="modeFeatures">
                <span class="featItem">💡 以语境理解驱动记忆</span>
                <span class="featItem">🖋️ 仅易错难写字激活手写</span>
                <span class="featItem">💭 支持心中默答自评</span>
              </div>
            </div>

            <!-- 模式 2：内容理解 -->
            <div
              class="modeCard"
              :class="{ active: selectedMode === 'understanding' }"
              @click="selectedMode = 'understanding'"
            >
              <div class="cardBadge">四维复盘透视</div>
              <div class="cardHeader">
                <span class="modeIcon">🔍</span>
                <span class="modeName">内容理解模式</span>
              </div>
              <p class="modeDesc">
                通过对我进行关于内容【有哪些、是什么、为什么、为了什么】方面的知识点复盘提问。
              </p>
              <div class="modeFeatures">
                <span class="featItem">📐 四大认知维度循序渐进</span>
                <span class="featItem">⌨️ 纯思维推导，免练手写</span>
                <span class="featItem">🧠 直击本质与因果机理</span>
              </div>
            </div>

            <!-- 模式 3：应试训练（占位） -->
            <div class="modeCard disabled">
              <div class="cardBadge waiting">⚡ 规划中 · 敬请期待</div>
              <div class="cardHeader">
                <span class="modeIcon">🎯</span>
                <span class="modeName">应试训练模式</span>
              </div>
              <p class="modeDesc">
                常考模型拆解、命题陷阱识别与破题策略应对。（本期暂未开放）
              </p>
              <div class="modeFeatures">
                <span class="featItem">🚧 题型母题拆解</span>
                <span class="featItem">🚧 破题策略构建</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部启动按钮 -->
        <div class="setupFooter">
          <el-button size="small" icon="el-icon-setting" @click="openConfig">
            API 配置
          </el-button>
          <el-button
            type="primary"
            size="medium"
            icon="el-icon-video-play"
            :disabled="targetScope === 'node' && !focusNodeId"
            @click="startInterrogationSession"
          >
            开启深度拷问 ➔
          </el-button>
        </div>
      </div>

      <!-- ================= 阶段 1：交互拷问进行中 ================= -->
      <div v-if="viewState === 'quiz'" class="quizContainer">
        <!-- 顶部信息栏 -->
        <div class="quizTopBar">
          <div class="modeTagBox">
            <el-tag size="small" :type="selectedMode === 'memory' ? 'warning' : 'primary'" effect="dark">
              {{ selectedMode === 'memory' ? '📖 内容记忆模式' : '🔍 内容理解模式' }}
            </el-tag>
            <span class="targetNodeTag">
              🎯 靶向：<strong>{{ targetScope === 'all' ? '全图宏观知识' : (selectedNodeSummary ? selectedNodeSummary.text : '指定分支') }}</strong>
            </span>
          </div>

          <div class="topOps">
            <el-button size="mini" type="text" icon="el-icon-back" @click="backToSetup">
              重选模式/节点
            </el-button>
            <el-button size="mini" type="text" icon="el-icon-setting" @click="openConfig">
              API 配置
            </el-button>
          </div>
        </div>

        <!-- 内容理解模式的四维步骤指示条 -->
        <div v-if="selectedMode === 'understanding'" class="dimensionStepsBar">
          <el-steps :active="understandingIndex" finish-status="success" align-center size="mini">
            <el-step title="第 1 维" description="有哪些"></el-step>
            <el-step title="第 2 维" description="是什么"></el-step>
            <el-step title="第 3 维" description="为什么"></el-step>
            <el-step title="第 4 维" description="为了什么"></el-step>
          </el-steps>
        </div>

        <!-- 考题展示卡片 -->
        <div v-if="currentQuiz" class="questionCard">
          <div class="qHeader">
            <el-tag size="mini" type="info">
              {{ selectedMode === 'understanding' ? currentQuiz.dimension_name : '核心考查' }}
            </el-tag>
            <span class="qTargetNode">📌 考查节点：{{ currentQuiz.target_node_text || '核心概念' }}</span>
          </div>
          <div class="qText">
            {{ currentQuiz.question }}
          </div>
          <div v-if="currentQuiz.understanding_hint" class="qHint">
            <span class="hintIcon">💡 思考引导支架：</span>
            <span class="hintContent">{{ currentQuiz.understanding_hint }}</span>
          </div>
        </div>

        <!-- 作答形式切换栏 -->
        <div class="answerMethodBar">
          <span class="barLabel">作答方式：</span>
          <el-radio-group v-model="answerType" size="mini">
            <el-radio-button label="mental">💭 心中默答 (看答案自评)</el-radio-button>
            <el-radio-button label="text">✍️ 键盘输入作答 (交由AI评分)</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 作答主区 A：心中默答 (看答案自评) -->
        <div v-if="answerType === 'mental'" class="mentalAnswerBox">
          <div v-if="!isAnswerRevealed" class="mentalPrompt">
            <p>请在心中思考推导或背诵该内容。准备完毕后，点击下方按钮核对标准答案与解析。</p>
            <el-button
              type="primary"
              size="medium"
              icon="el-icon-view"
              @click="isAnswerRevealed = true"
            >
              👀 揭晓标准答案与采分解析
            </el-button>
          </div>

          <div v-else class="revealedContent">
            <div class="standardAnswerCard">
              <div class="cardTitle">✅ 官方标准答案 / 完整表述：</div>
              <div class="cardBody">{{ currentQuiz.standard_answer || currentQuiz.evaluation_criteria }}</div>
            </div>

            <div v-if="currentQuiz.evaluation_criteria && currentQuiz.evaluation_criteria !== currentQuiz.standard_answer" class="criteriaCard">
              <div class="cardTitle">📌 答题采分关键点：</div>
              <div class="cardBody">{{ currentQuiz.evaluation_criteria }}</div>
            </div>
          </div>
        </div>

        <!-- 作答主区 B：键盘输入作答 (交由AI评分) -->
        <div v-else class="textAnswerBox">
          <el-input
            type="textarea"
            :rows="4"
            placeholder="请在此输入您的推导过程、理解回答或背诵文本..."
            v-model="userAnswerText"
            :disabled="judging || !!currentJudgeResult"
          ></el-input>

          <div class="submitRow" v-if="!currentJudgeResult">
            <el-button
              type="success"
              size="small"
              icon="el-icon-check"
              @click="submitTextAnswer"
              :disabled="!userAnswerText.trim() || judging"
              :loading="judging"
            >
              {{ judging ? '考官严苛审判中...' : '提交答案 · 接受审判' }}
            </el-button>
          </div>

          <!-- AI 审判结果反馈 -->
          <div v-if="currentJudgeResult" class="judgeFeedbackBox">
            <div class="judgeHeader">
              <el-tag size="small" :type="getGradeTagType(currentJudgeResult.grade)">
                考官评分：{{ getGradeLabel(currentJudgeResult.grade) }}
              </el-tag>
            </div>
            <div class="critiqueText">
              <strong>【考官点评】</strong>：{{ currentJudgeResult.interrogation_critique }}
            </div>
            <div v-if="currentQuiz.standard_answer" class="standardRef">
              <strong>【标准参考】</strong>：{{ currentQuiz.standard_answer }}
            </div>
          </div>
        </div>

        <!-- 特别模块（仅限内容记忆模式）：生僻/易错字田字格书写专项训练 -->
        <div
          v-if="selectedMode === 'memory' && currentQuiz.has_difficult_chars && currentQuiz.difficult_chars && currentQuiz.difficult_chars.length && (isAnswerRevealed || currentJudgeResult)"
          class="difficultCharsSection"
        >
          <div class="secHeader">
            <span class="icon">🖋️</span>
            <strong>古诗文生僻/易错字书写专练</strong>
            <span class="subTip">检测到本句易错生僻字：</span>
            <el-tag
              v-for="char in currentQuiz.difficult_chars"
              :key="char"
              type="danger"
              size="small"
              class="charTag"
            >
              {{ char }}
            </el-tag>
          </div>
          <p class="secDesc">遵循“仅对难写字练字”原则，无需通篇抄写，仅需在下方数位板中练习以上易错字。</p>

          <div class="handwritingWrapper">
            <ReviewHandwritingBoard
              :card="difficultCharCard"
              :is-dark="false"
            />
          </div>
        </div>

        <!-- 用户自主决定复习安排控制台 (AI 绝不强制自动篡改复习安排) -->
        <div v-if="isAnswerRevealed || currentJudgeResult" class="manualScheduleSection">
          <div class="manualHeader">
            <span class="icon">🗓️</span>
            <span class="title">手动选择复习安排（由您决定是否更新该节点进度）：</span>
          </div>

          <div class="ratingButtonsRow">
            <el-button
              size="small"
              :type="manualRating === 'mastered' ? 'success' : 'default'"
              @click="applyManualSchedule('mastered')"
            >
              🌟 熟练掌握
            </el-button>
            <el-button
              size="small"
              :type="manualRating === 'remember' ? 'primary' : 'default'"
              @click="applyManualSchedule('remember')"
            >
              ✅ 记得 (推进周期)
            </el-button>
            <el-button
              size="small"
              :type="manualRating === 'fuzzy' ? 'warning' : 'default'"
              @click="applyManualSchedule('fuzzy')"
            >
              🤔 模糊 (间隔减半)
            </el-button>
            <el-button
              size="small"
              :type="manualRating === 'forgot' ? 'danger' : 'default'"
              @click="applyManualSchedule('forgot')"
            >
              ❌ 忘记 (今日重背)
            </el-button>
          </div>

          <div v-if="scheduleFeedbackMsg" class="feedbackStatus">
            {{ scheduleFeedbackMsg }}
          </div>
        </div>

        <!-- 底部流转按钮 -->
        <div v-if="isAnswerRevealed || currentJudgeResult" class="quizFooterRow">
          <el-button
            type="primary"
            size="medium"
            icon="el-icon-right"
            @click="nextQuestion"
          >
            {{ isLastQuestion ? '查看本轮考核综合报告 ➔' : '进入下一问 ➔' }}
          </el-button>
        </div>
      </div>

      <!-- ================= 阶段 2：全景考核鉴定报告 ================= -->
      <div v-if="viewState === 'report'" class="reportContainer">
        <div class="reportHeader">
          <div class="reportBadge">
            <span class="scoreIcon">🏆</span>
            <div class="scoreInfo">
              <span class="title">本轮拷问复盘报告</span>
              <span class="sub">已完成全部问题考查，思维与记忆链路已沉淀</span>
            </div>
          </div>
        </div>

        <div class="historyQuestionsList">
          <div
            v-for="(record, idx) in sessionRecords"
            :key="idx"
            class="recordCard"
          >
            <div class="cardHeaderRow">
              <el-tag size="mini" type="primary">第 {{ idx + 1 }} 问 · {{ record.quiz.dimension_name || '内容记忆' }}</el-tag>
              <span class="targetText">📌 {{ record.quiz.target_node_text }}</span>
              <el-tag size="mini" :type="record.manualRating ? 'success' : 'info'">
                复习标记: {{ getRatingText(record.manualRating) }}
              </el-tag>
            </div>
            <div class="recordQuestion">
              {{ record.quiz.question }}
            </div>
            <div class="recordAnswer">
              <strong>您的作答：</strong>
              <span>{{ record.answerText || '心中默答对照解析' }}</span>
            </div>
            <div v-if="record.judgeResult" class="recordCritique">
              <strong>考官审判：</strong> {{ record.judgeResult.interrogation_critique }}
            </div>
          </div>
        </div>

        <div class="reportFooterRow">
          <el-button size="medium" @click="backToSetup">
            重设范围并开启新一轮
          </el-button>
          <el-button type="primary" size="medium" @click="visible = false">
            完成并关闭
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import {
  generateMemoryQuiz,
  generateUnderstandingQuiz
} from '@/review/mindMapAuditor'
import { getJudgeAiConfig } from '@/review/handwritingJudge'
import { rateReview } from '@/review/index'
import ReviewHandwritingBoard from './ReviewHandwritingBoard.vue'

const UNDERSTANDING_DIMS = ['which', 'what', 'why', 'for_what']

export default {
  name: 'AiInterrogationDialog',
  components: {
    ReviewHandwritingBoard
  },
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
      loadingText: 'AI 考官正在生成题目...',
      judging: false,

      // 阶段状态: 'setup' (前置准备与选择), 'quiz' (拷问中), 'report' (考核报告)
      viewState: 'setup',

      // 模式: 'memory' (内容记忆), 'understanding' (内容理解), 'exam' (应试训练)
      selectedMode: 'understanding',

      // 范围: 'node' (单节点及子树), 'all' (全图)
      targetScope: 'node',
      focusNodeId: null,
      allMapNodes: [],
      selectedNodeSummary: null,

      // 内容理解四维索引: 0(有哪些), 1(是什么), 2(为什么), 3(为了什么)
      understandingIndex: 0,

      // 内容记忆题号索引: 0, 1, 2
      memoryIndex: 0,
      memoryTotalQuestions: 3,

      // 当前题目与作答
      currentQuiz: null,
      answerType: 'mental', // 'mental' (心中默答), 'text' (键盘输入)
      userAnswerText: '',
      isAnswerRevealed: false,
      currentJudgeResult: null,

      // 手动复习安排控制
      manualRating: null, // 'remember' | 'fuzzy' | 'forgot' | 'mastered'
      scheduleFeedbackMsg: '',

      // 本轮答题历史记录
      sessionRecords: []
    }
  },
  created() {
    this.$bus.$on('showAiInterrogation', (payload) => {
      this.show(payload)
    })
  },
  beforeDestroy() {
    this.$bus.$off('showAiInterrogation')
  },
  computed: {
    isLastQuestion() {
      if (this.selectedMode === 'understanding') {
        return this.understandingIndex >= 3
      }
      return this.memoryIndex >= this.memoryTotalQuestions - 1
    },
    difficultCharCard() {
      if (!this.currentQuiz || !this.currentQuiz.difficult_chars) return null
      const chars = this.currentQuiz.difficult_chars.join('、')
      return {
        id: this.currentQuiz.target_node_id || 'char_quiz',
        front: `请默写易错难写字：【${chars}】`,
        back: this.currentQuiz.difficult_chars.join(' ')
      }
    }
  },
  methods: {
    show(payload = {}) {
      this.visible = true
      this.viewState = 'setup'
      this.sessionRecords = []

      // 收集导图全量节点供下拉选择
      this.refreshMapNodes()

      if (payload && payload.focusNodeId) {
        this.targetScope = 'node'
        this.focusNodeId = payload.focusNodeId
      } else {
        this.checkCanvasSelection()
      }
      this.updateSelectedNodeSummary()
    },
    openConfig() {
      this.$bus.$emit('showAiConfig')
    },
    getRootNode() {
      if (!this.mindMap) return null
      const raw = this.mindMap.getData(false)
      if (raw && (raw.root || raw.data)) {
        return raw.root || raw
      }
      if (this.mindMap.renderer && this.mindMap.renderer.root) {
        return this.mindMap.renderer.root.nodeData
      }
      return null
    },
    refreshMapNodes() {
      const root = this.getRootNode()
      if (!root) {
        this.allMapNodes = []
        return
      }
      const list = []
      const traverse = (node, depth = 0, path = '') => {
        if (!node || !node.data) return
        const id = node.data.uid || node.data.id
        const text = (node.data.text || '').replace(/<[^>]+>/g, '').trim() || '未命名'
        const fullPath = path ? `${path} ➔ ${text}` : text
        const children = node.children || []
        list.push({
          id,
          text,
          label: '　'.repeat(depth) + (depth > 0 ? '└─ ' : '') + text,
          fullPath,
          childrenCount: children.length,
          previewChildren: children.slice(0, 6).map(c => (c.data?.text || '').replace(/<[^>]+>/g, '').trim()).filter(Boolean)
        })
        children.forEach(c => traverse(c, depth + 1, fullPath))
      }
      traverse(root, 0, '')
      this.allMapNodes = list
    },
    checkCanvasSelection() {
      if (this.mindMap && this.mindMap.renderer) {
        const list = this.mindMap.renderer.activeNodeList || []
        if (list.length > 0) {
          const node = list[0]
          this.focusNodeId = node.nodeData?.data?.uid || node.nodeData?.data?.id || null
          this.targetScope = 'node'
          return
        }
      }
      // 默认选择根节点或全图
      if (this.allMapNodes.length > 0) {
        this.focusNodeId = this.allMapNodes[0].id
        this.targetScope = 'node'
      } else {
        this.targetScope = 'all'
      }
    },
    onScopeChange(val) {
      if (val === 'node' && !this.focusNodeId && this.allMapNodes.length > 0) {
        this.focusNodeId = this.allMapNodes[0].id
      }
      this.updateSelectedNodeSummary()
    },
    onNodeSelectChange() {
      this.updateSelectedNodeSummary()
    },
    updateSelectedNodeSummary() {
      if (this.targetScope === 'node' && this.focusNodeId) {
        this.selectedNodeSummary = this.allMapNodes.find(n => n.id === this.focusNodeId) || null
      } else {
        this.selectedNodeSummary = null
      }
    },
    startInterrogationSession() {
      const cfg = getJudgeAiConfig()
      if (!cfg.apiKey) {
        this.$message.info('首次使用请先配置大模型 API Key（支持 Gemini、DeepSeek、OpenAI 等）')
        this.openConfig()
        return
      }

      this.viewState = 'quiz'
      this.understandingIndex = 0
      this.memoryIndex = 0
      this.sessionRecords = []
      this.loadCurrentQuestion()
    },
    backToSetup() {
      this.viewState = 'setup'
      this.refreshMapNodes()
      this.updateSelectedNodeSummary()
    },
    async loadCurrentQuestion() {
      const rootNode = this.getRootNode()
      if (!rootNode || !rootNode.data) {
        this.$message.warning('当前导图内容为空，请先绘制内容')
        this.backToSetup()
        return
      }

      this.loading = true
      this.currentQuiz = null
      this.userAnswerText = ''
      this.isAnswerRevealed = false
      this.currentJudgeResult = null
      this.manualRating = null
      this.scheduleFeedbackMsg = ''

      const focusId = this.targetScope === 'node' ? this.focusNodeId : null

      try {
        if (this.selectedMode === 'understanding') {
          const dimKey = UNDERSTANDING_DIMS[this.understandingIndex] || 'what'
          this.loadingText = `AI 考官正在生成【${this.getDimensionName(dimKey)}】深度复盘考题...`
          const quiz = await generateUnderstandingQuiz(rootNode, {
            focusNodeId: focusId,
            dimension: dimKey
          })
          if (!quiz || !quiz.question) throw new Error('考题数据格式异常，请重试')
          this.currentQuiz = quiz
        } else {
          this.loadingText = `AI 考官正在生成第 ${this.memoryIndex + 1} 题内容记忆考题...`
          const quiz = await generateMemoryQuiz(rootNode, {
            focusNodeId: focusId
          })
          if (!quiz || !quiz.question) throw new Error('考题数据格式异常，请重试')
          this.currentQuiz = quiz
        }
      } catch (err) {
        this.$message.error(err.message || '生成考题失败，请检查网络或 API 配置')
      } finally {
        this.loading = false
      }
    },
    getDimensionName(key) {
      const map = {
        which: '有哪些',
        what: '是什么',
        why: '为什么',
        for_what: '为了什么'
      }
      return map[key] || '深度理解'
    },
    async submitTextAnswer() {
      if (!this.userAnswerText.trim() || !this.currentQuiz) return

      this.judging = true
      try {
        const cfg = getJudgeAiConfig()
        const endpoint = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`

        const judgePrompt = `【考官审判任务】
考查模式：${this.selectedMode === 'memory' ? '内容记忆与理解' : '内容深度理解'}
考查问题：${this.currentQuiz.question}
标准要点：${this.currentQuiz.standard_answer || this.currentQuiz.evaluation_criteria || '逻辑自洽'}
学生作答：${this.userAnswerText.trim()}

请以高考阅卷组长口吻对学生作答进行审评打分（强制输出合法的 JSON 对象）：
{
  "grade": 3 | 2 | 1 | 0, // 3: 完全正确推导清晰; 2: 答对但略有瑕疵; 1: 概念混淆或前提缺失; 0: 完全错误或答非所问
  "interrogation_critique": "一针见血指出学生答案中的核心思维漏洞、条件缺失或精准点拨"
}`

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify({
            model: cfg.modelName,
            temperature: 0.0,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: judgePrompt }]
          })
        })

        if (!res.ok) throw new Error(`审判接口请求失败 (${res.status})`)
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || '{}'
        const parsed = JSON.parse(content)
        this.currentJudgeResult = parsed
      } catch (e) {
        this.$message.error(e.message || '审判失败')
      } finally {
        this.judging = false
      }
    },
    applyManualSchedule(rating) {
      this.manualRating = rating
      const nodeId = this.currentQuiz?.target_node_id || this.focusNodeId
      if (nodeId) {
        try {
          rateReview(nodeId, rating)
          const map = {
            mastered: '🌟 已手动标记为【熟练掌握】，移出高频打扰！',
            remember: '✅ 已手动标记为【记得】，复习周期已向后推进！',
            fuzzy: '🤔 已手动标记为【模糊】，周期间隔已减半以高频巩固！',
            forgot: '❌ 已手动标记为【忘记】，已重置周期并推入今日待办！'
          }
          this.scheduleFeedbackMsg = map[rating] || '已更新复习安排'
          this.$message.success(this.scheduleFeedbackMsg)
        } catch (err) {
          this.scheduleFeedbackMsg = '标记复习状态成功'
        }
      }
    },
    nextQuestion() {
      // 沉淀记录
      this.sessionRecords.push({
        quiz: this.currentQuiz,
        answerType: this.answerType,
        answerText: this.answerType === 'text' ? this.userAnswerText.trim() : '心中默答对照解析',
        judgeResult: this.currentJudgeResult,
        manualRating: this.manualRating
      })

      if (this.isLastQuestion) {
        this.viewState = 'report'
        return
      }

      if (this.selectedMode === 'understanding') {
        this.understandingIndex += 1
      } else {
        this.memoryIndex += 1
      }
      this.loadCurrentQuestion()
    },
    getGradeTagType(grade) {
      if (grade === 3) return 'success'
      if (grade === 2) return 'warning'
      return 'danger'
    },
    getGradeLabel(grade) {
      if (grade === 3) return '3分 · 优秀通过'
      if (grade === 2) return '2分 · 稍有瑕疵'
      if (grade === 1) return '1分 · 存在漏洞'
      return '0分 · 答非所问'
    },
    getRatingText(rating) {
      const map = {
        mastered: '🌟 熟练',
        remember: '✅ 记得',
        fuzzy: '🤔 模糊',
        forgot: '❌ 忘记'
      }
      return map[rating] || '未手动标记'
    }
  }
}
</script>

<style lang="less" scoped>
.aiInterrogationDialog {
  border-radius: 12px;
  overflow: hidden;
}

.dialogBody {
  min-height: 480px;
  padding: 8px 4px;
}

/* 前置设置阶段 */
.setupContainer {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .setupSection {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 16px;

    .sectionTitle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 12px;

      .icon {
        font-size: 18px;
      }
    }

    .scopeToggle {
      margin-bottom: 12px;
    }

    .nodeSelectBox {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .selectorRow {
        display: flex;
        align-items: center;
        gap: 8px;

        .label {
          font-size: 13px;
          color: #475569;
          white-space: nowrap;
        }
      }

      .nodePreviewCard {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 12px;
        margin-top: 4px;

        .cardTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;

          .nodeName {
            color: #0f172a;
            font-size: 14px;
          }
        }

        .nodePath {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;

          .pathLabel {
            color: #94a3b8;
          }
        }

        .subChildrenPreview {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 12px;

          .previewLabel {
            color: #64748b;
          }

          .childTag {
            background: #f1f5f9;
            border-color: #e2e8f0;
            color: #334155;
          }

          .moreTag {
            color: #94a3b8;
          }
        }
      }
    }
  }

  .modeCardsGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    .modeCard {
      position: relative;
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;

      &:hover:not(.disabled) {
        border-color: #3b82f6;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        transform: translateY(-2px);
      }

      &.active {
        border-color: #2563eb;
        background: #eff6ff;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
      }

      &.disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: #f8fafc;
      }

      .cardBadge {
        position: absolute;
        top: -9px;
        right: 10px;
        background: #2563eb;
        color: #ffffff;
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 500;

        &.waiting {
          background: #94a3b8;
        }
      }

      .cardHeader {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;

        .modeIcon {
          font-size: 20px;
        }

        .modeName {
          font-size: 14px;
          font-weight: bold;
          color: #0f172a;
        }
      }

      .modeDesc {
        font-size: 12px;
        color: #64748b;
        line-height: 1.5;
        margin-bottom: 12px;
        flex: 1;
      }

      .modeFeatures {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .featItem {
          font-size: 11px;
          color: #334155;
          background: rgba(0, 0, 0, 0.03);
          padding: 2px 6px;
          border-radius: 4px;
        }
      }
    }
  }

  .setupFooter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
  }
}

/* 拷问进行中 */
.quizContainer {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .quizTopBar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;

    .modeTagBox {
      display: flex;
      align-items: center;
      gap: 10px;

      .targetNodeTag {
        font-size: 13px;
        color: #475569;
      }
    }
  }

  .dimensionStepsBar {
    background: #f8fafc;
    border-radius: 8px;
    padding: 10px 12px;
  }

  .questionCard {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #3b82f6;
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);

    .qHeader {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .qTargetNode {
        font-size: 12px;
        color: #64748b;
      }
    }

    .qText {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .qHint {
      background: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;

      .hintIcon {
        color: #ca8a04;
        font-weight: bold;
      }

      .hintContent {
        color: #713f12;
      }
    }
  }

  .answerMethodBar {
    display: flex;
    align-items: center;
    gap: 8px;

    .barLabel {
      font-size: 13px;
      font-weight: bold;
      color: #334155;
    }
  }

  .mentalAnswerBox {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 16px;

    .mentalPrompt {
      text-align: center;
      color: #64748b;
      font-size: 13px;

      p {
        margin-bottom: 12px;
      }
    }

    .revealedContent {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .standardAnswerCard {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        padding: 10px 12px;

        .cardTitle {
          font-weight: bold;
          font-size: 13px;
          color: #166534;
          margin-bottom: 4px;
        }

        .cardBody {
          font-size: 14px;
          color: #14532d;
          line-height: 1.5;
        }
      }

      .criteriaCard {
        background: #fefce8;
        border: 1px solid #fef08a;
        border-radius: 6px;
        padding: 8px 12px;

        .cardTitle {
          font-weight: bold;
          font-size: 12px;
          color: #854d0e;
          margin-bottom: 4px;
        }

        .cardBody {
          font-size: 13px;
          color: #713f12;
          line-height: 1.4;
        }
      }
    }
  }

  .textAnswerBox {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .submitRow {
      display: flex;
      justify-content: flex-end;
    }

    .judgeFeedbackBox {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;

      .judgeHeader {
        margin-bottom: 6px;
      }

      .critiqueText {
        font-size: 13px;
        color: #1e293b;
        line-height: 1.5;
        margin-bottom: 6px;
      }

      .standardRef {
        font-size: 12px;
        color: #475569;
        background: #ffffff;
        padding: 6px;
        border-radius: 4px;
      }
    }
  }

  /* 难写字手写专练 */
  .difficultCharsSection {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    border-radius: 8px;
    padding: 12px;

    .secHeader {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #9f1239;
      margin-bottom: 4px;

      .charTag {
        font-size: 14px;
        font-weight: bold;
      }
    }

    .secDesc {
      font-size: 12px;
      color: #be123c;
      margin-bottom: 8px;
    }

    .handwritingWrapper {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }
  }

  /* 手动选择复习安排控制台 */
  .manualScheduleSection {
    background: #faf5ff;
    border: 1px solid #f3e8ff;
    border-radius: 8px;
    padding: 12px;

    .manualHeader {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: bold;
      color: #6b21a8;
      margin-bottom: 10px;
    }

    .ratingButtonsRow {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .feedbackStatus {
      font-size: 12px;
      color: #15803d;
      margin-top: 8px;
      font-weight: 500;
    }
  }

  .quizFooterRow {
    display: flex;
    justify-content: flex-end;
    padding-top: 6px;
  }
}

/* 总结报告阶段 */
.reportContainer {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .reportHeader {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #bfdbfe;
    border-radius: 10px;
    padding: 16px;

    .reportBadge {
      display: flex;
      align-items: center;
      gap: 12px;

      .scoreIcon {
        font-size: 32px;
      }

      .scoreInfo {
        display: flex;
        flex-direction: column;

        .title {
          font-size: 16px;
          font-weight: bold;
          color: #1e3a8a;
        }

        .sub {
          font-size: 12px;
          color: #3b82f6;
        }
      }
    }
  }

  .historyQuestionsList {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 380px;
    overflow-y: auto;

    .recordCard {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;

      .cardHeaderRow {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;

        .targetText {
          font-size: 12px;
          color: #475569;
          flex: 1;
        }
      }

      .recordQuestion {
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 4px;
      }

      .recordAnswer {
        font-size: 12px;
        color: #475569;
        margin-bottom: 4px;
      }

      .recordCritique {
        font-size: 12px;
        color: #0369a1;
        background: #f0f9ff;
        padding: 4px 8px;
        border-radius: 4px;
      }
    }
  }

  .reportFooterRow {
    display: flex;
    justify-content: space-between;
    padding-top: 8px;
  }
}
</style>
