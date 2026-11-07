<template>
  <el-dialog
    title="⚙️ 大模型 API 接口与密钥配置 (BYOK)"
    :visible.sync="visible"
    width="560px"
    :append-to-body="true"
    custom-class="reviewAiConfigDialog"
  >
    <div class="configBody">
      <div class="tipBanner">
        💡 采用纯前端安全连接（直连大模型官方接口），您的 API Key 仅保存在浏览器本地，绝不上传任何中转服务器。
      </div>

      <el-form label-width="110px" size="small" class="configForm">
        <el-form-item label="快捷服务预设">
          <el-button-group>
            <el-button size="mini" type="primary" plain @click="applyPreset('gemini')">
              🌟 Google Gemini (推荐)
            </el-button>
            <el-button size="mini" @click="applyPreset('deepseek')">
              ⚡ DeepSeek 官方
            </el-button>
            <el-button size="mini" @click="applyPreset('openai')">
              OpenAI
            </el-button>
            <el-button size="mini" @click="applyPreset('silicon')">
              硅基流动
            </el-button>
          </el-button-group>
        </el-form-item>

        <el-form-item label="API Key (密钥)">
          <el-input
            v-model="form.apiKey"
            placeholder="例如: AIzaSy... 或 sk-..."
            show-password
          ></el-input>
          <div class="fieldHint" v-if="presetType === 'gemini'">
            👉 <a href="https://aistudio.google.com/" target="_blank" style="color: #409eff;">点击前往 Google AI Studio 免费获取 Gemini Key (AIzaSy...)</a>
          </div>
          <div class="fieldHint" v-else-if="presetType === 'deepseek'">
            👉 <a href="https://platform.deepseek.com/" target="_blank" style="color: #409eff;">点击前往 DeepSeek 开放平台获取 Key (sk-...)</a>
          </div>
        </el-form-item>

        <el-form-item label="Base URL (端点)">
          <el-input
            v-model="form.baseUrl"
            placeholder="https://api.openai.com/v1"
          ></el-input>
          <div class="fieldHint">兼容任何 OpenAI 协议端点（如 Gemini、DeepSeek、OneAPI、Ollama）</div>
        </el-form-item>

        <el-form-item label="Model (模型名)">
          <el-input
            v-model="form.modelName"
            placeholder="gemini-1.5-pro / deepseek-chat / gpt-4o"
          ></el-input>
          <div class="fieldHint">推荐: <code>gemini-1.5-pro</code>（200万超大上下文）、<code>deepseek-chat</code></div>
        </el-form-item>
      </el-form>
    </div>

    <div slot="footer" class="dialog-footer">
      <el-button size="small" @click="visible = false">取消</el-button>
      <el-button size="small" type="primary" icon="el-icon-check" @click="save">保存配置</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { getJudgeAiConfig, saveJudgeAiConfig } from '@/review/handwritingJudge'

export default {
  name: 'ReviewAiConfigDialog',
  data() {
    return {
      visible: false,
      presetType: 'gemini',
      form: {
        apiKey: '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        modelName: 'gemini-1.5-pro'
      }
    }
  },
  created() {
    this.$bus.$on('showAiConfig', () => {
      this.show()
    })
  },
  beforeDestroy() {
    this.$bus.$off('showAiConfig')
  },
  methods: {
    show() {
      const cfg = getJudgeAiConfig()
      this.form = {
        apiKey: cfg.apiKey || '',
        baseUrl: cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
        modelName: cfg.modelName || 'gemini-1.5-pro'
      }
      if (this.form.baseUrl.includes('googleapis.com')) {
        this.presetType = 'gemini'
      } else if (this.form.baseUrl.includes('deepseek.com')) {
        this.presetType = 'deepseek'
      }
      this.visible = true
    },
    applyPreset(type) {
      this.presetType = type
      if (type === 'gemini') {
        this.form.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'
        this.form.modelName = 'gemini-1.5-pro'
      } else if (type === 'deepseek') {
        this.form.baseUrl = 'https://api.deepseek.com/v1'
        this.form.modelName = 'deepseek-chat'
      } else if (type === 'openai') {
        this.form.baseUrl = 'https://api.openai.com/v1'
        this.form.modelName = 'gpt-4o-mini'
      } else if (type === 'silicon') {
        this.form.baseUrl = 'https://api.siliconflow.cn/v1'
        this.form.modelName = 'deepseek-ai/DeepSeek-V3'
      }
    },
    save() {
      if (!this.form.apiKey.trim()) {
        this.$message.warning('请输入 API Key')
        return
      }
      saveJudgeAiConfig(this.form)
      this.visible = false
      this.$message.success('AI 接口与密钥配置已保存！')
    }
  }
}
</script>

<style lang="less" scoped>
.configBody {
  .tipBanner {
    background: #ecf5ff;
    border: 1px solid #d9ecff;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    color: #409eff;
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .configForm {
    .fieldHint {
      font-size: 12px;
      color: #909399;
      line-height: 1.4;
      margin-top: 4px;

      code {
        background: #f4f4f5;
        padding: 2px 4px;
        border-radius: 3px;
        color: #e6a23c;
      }
    }
  }
}
</style>
