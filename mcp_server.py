# -*- coding: utf-8 -*-
"""
ReviewMind MCP Server (Model Context Protocol)
支持 Google Gemini Advanced、Claude 等 AI 客户端通过 SSE/HTTP 协议远程连接思维导图。
实现功能：
1. 实时读取当前编辑中的导图与历史导图；
2. 4 维学术逻辑体检与纠错诊断（严格禁止 AI 代写子节点）；
3. 苏格拉底式启发性自动深度拷问出题；
4. 复习卡片与 SM-2 记忆算法进度查询。
"""

import os
import json
import re
import uuid
import queue
import threading
from urllib.parse import urlparse, parse_qs

# HTML 标签清理正则
TAG_RE = re.compile(r'<[^>]+>')


def strip_html(text):
    if not text or not isinstance(text, str):
        return ''
    cleaned = TAG_RE.sub('', text)
    cleaned = cleaned.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    return cleaned.strip()


def node_to_markdown(node, depth=1, max_depth=6):
    """将 simple-mind-map 节点树递归转换为标准 Markdown 知识层级大纲"""
    if not node or depth > max_depth:
        return []
    
    lines = []
    data = node.get('data') or {}
    text = strip_html(data.get('text', ''))
    note = strip_html(data.get('note', ''))
    tags = data.get('tag') or []
    node_id = data.get('uid') or data.get('id') or ''
    
    indent = '  ' * (depth - 1)
    tag_str = f" [标签: {', '.join(tags)}]" if tags else ""
    note_str = f" (备注: {note})" if note else ""
    id_str = f" [ID: {node_id}]" if node_id else ""
    
    if text:
        lines.append(f"{indent}- {text}{id_str}{tag_str}{note_str}")
    
    children = node.get('children') or []
    for child in children:
        lines.extend(node_to_markdown(child, depth + 1, max_depth))
        
    return lines


def extract_root_node(file_data):
    """鲁棒提取思维导图的根节点对象（兼容 { root: ... } 结构或直接根节点结构）"""
    if not file_data or not isinstance(file_data, dict):
        return None
    if 'root' in file_data and isinstance(file_data['root'], dict):
        return file_data['root']
    if 'data' in file_data and isinstance(file_data['data'], dict):
        return file_data
    return None


class MCPServer:
    def __init__(self, store_dir):
        self.store_dir = store_dir
        self.sessions = {}  # session_id -> queue.Queue
        self.lock = threading.Lock()

    def create_session(self):
        session_id = uuid.uuid4().hex
        q = queue.Queue(maxsize=100)
        with self.lock:
            self.sessions[session_id] = q
        return session_id

    def remove_session(self, session_id):
        with self.lock:
            self.sessions.pop(session_id, None)

    def push_to_session(self, session_id, message):
        with self.lock:
            q = self.sessions.get(session_id)
        if q:
            try:
                q.put_nowait(message)
            except queue.Full:
                pass

    # ---------- 存储数据读取辅助函数 ----------
    def get_current_file_id(self):
        fp = os.path.join(self.store_dir, 'SIMPLE_MIND_MAP_CURRENT_FILE.json')
        if os.path.isfile(fp):
            try:
                with open(fp, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            except Exception:
                pass
        return None

    def get_file_list(self):
        fp = os.path.join(self.store_dir, 'SIMPLE_MIND_MAP_FILE_LIST.json')
        if os.path.isfile(fp):
            try:
                with open(fp, 'r', encoding='utf-8') as f:
                    return json.loads(f.read())
            except Exception:
                pass
        return []

    def get_file_data(self, file_id):
        if not file_id:
            return None
        fp = os.path.join(self.store_dir, f'SIMPLE_MIND_MAP_FILE_{file_id}.json')
        if os.path.isfile(fp):
            try:
                with open(fp, 'r', encoding='utf-8') as f:
                    return json.loads(f.read())
            except Exception:
                pass
        return None

    def get_review_data(self):
        fp = os.path.join(self.store_dir, 'MIND_MAP_REVIEW_DATA.json')
        if os.path.isfile(fp):
            try:
                with open(fp, 'r', encoding='utf-8') as f:
                    return json.loads(f.read())
            except Exception:
                pass
        return {}

    # ---------- MCP 工具实现 ----------
    def list_tools(self):
        return [
            {
                "name": "get_active_mindmap",
                "description": "获取用户当前在 ReviewMind 中处于打开激活状态的思维导图完整大纲、核心概念、节点层级与备注信息。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "max_depth": {
                            "type": "integer",
                            "description": "递归读取最大层级深度，默认 6 层",
                            "default": 6
                        }
                    }
                }
            },
            {
                "name": "list_mindmaps",
                "description": "获取用户本地保存的所有思维导图清单（包含导图名称、ID、创建时间、更新时间）。",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_mindmap_by_name",
                "description": "根据导图名称或导图 ID 精准读取指定思维导图的知识结构大纲。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name_or_id": {
                            "type": "string",
                            "description": "思维导图名称（如《高考物理电磁感应》）或文件ID"
                        },
                        "max_depth": {
                            "type": "integer",
                            "description": "递归读取最大层级深度，默认 6 层",
                            "default": 6
                        }
                    },
                    "required": ["name_or_id"]
                }
            },
            {
                "name": "audit_mindmap_logic",
                "description": "对用户当前或指定导图执行严格的学术与逻辑体检。挖掘事实硬伤、层级倒置、缺少前提条件与混淆概念。【铁律】：绝对禁止替用户代写补全子节点，仅提供一针见血的定位反思建议与自查思考题。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name_or_id": {
                            "type": "string",
                            "description": "可选。导图名称或文件ID，若不填则体检当前激活导图"
                        },
                        "focus_topic": {
                            "type": "string",
                            "description": "可选。若用户指定聚焦于某一具体分支主题（如‘动量守恒’），填入该名称"
                        }
                    }
                }
            },
            {
                "name": "generate_socratic_quiz",
                "description": "根据思维导图的核心概念，生成苏格拉底式启发性考题（溯源本质题、逻辑推导题或边界反例题），考查学生的真实理解深度。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name_or_id": {
                            "type": "string",
                            "description": "可选。导图名称或文件ID，若不填则考查当前导图"
                        },
                        "question_type": {
                            "type": "string",
                            "enum": ["essence", "derivation", "counterexample", "all"],
                            "description": "考查类型：essence(溯源本质), derivation(逻辑推导), counterexample(边界反例), all(全能综合)",
                            "default": "all"
                        }
                    }
                }
            },
            {
                "name": "get_review_progress",
                "description": "获取当前思维导图的复习卡片、错题薄弱点统计及 SM-2 间隔复习调度数据。",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

    def call_tool(self, name, args):
        args = args or {}
        if name == 'get_active_mindmap':
            curr_id = self.get_current_file_id()
            if not curr_id:
                file_list = self.get_file_list()
                if file_list:
                    curr_id = file_list[0].get('id')
            if not curr_id:
                return "【提示】当前本地尚未创建或打开任何思维导图文件。"
            
            file_data = self.get_file_data(curr_id)
            root_node = extract_root_node(file_data)
            if not root_node:
                return f"【提示】未找到 ID 为 {curr_id} 的思维导图有效内容。"
            
            # 获取导图名称
            file_list = self.get_file_list()
            file_name = "我的思维导图"
            for item in file_list:
                if item.get('id') == curr_id:
                    file_name = item.get('name', file_name)
                    break
                    
            max_depth = args.get('max_depth', 6)
            outline_lines = node_to_markdown(root_node, 1, max_depth)
            outline_text = "\n".join(outline_lines)
            
            return f"### 思维导图：《{file_name}》 (ID: {curr_id})\n\n```markdown\n{outline_text}\n```"

        elif name == 'list_mindmaps':
            file_list = self.get_file_list()
            curr_id = self.get_current_file_id()
            if not file_list:
                return "本地知识库目前没有任何思维导图。"
            
            lines = ["### 用户本地思维导图列表："]
            for f in file_list:
                is_curr = " [当前正激活打开]" if f.get('id') == curr_id else ""
                lines.append(f"- 📄 **{f.get('name')}** (ID: `{f.get('id')}`){is_curr}")
            return "\n".join(lines)

        elif name == 'get_mindmap_by_name':
            target = args.get('name_or_id', '').strip()
            if not target:
                return "请提供要查询的思维导图名称或 ID。"
            
            file_list = self.get_file_list()
            matched_id = None
            matched_name = target
            for item in file_list:
                if item.get('id') == target or target.lower() in item.get('name', '').lower():
                    matched_id = item.get('id')
                    matched_name = item.get('name')
                    break
                    
            if not matched_id:
                return f"未能匹配到包含名称 '{target}' 的思维导图文件。"
            
            file_data = self.get_file_data(matched_id)
            root_node = extract_root_node(file_data)
            if not root_node:
                return f"导图文件《{matched_name}》损坏或内容为空。"
                
            max_depth = args.get('max_depth', 6)
            outline_lines = node_to_markdown(root_node, 1, max_depth)
            outline_text = "\n".join(outline_lines)
            return f"### 思维导图：《{matched_name}》 (ID: {matched_id})\n\n```markdown\n{outline_text}\n```"

        elif name == 'audit_mindmap_logic':
            # 读取导图内容
            target = args.get('name_or_id', '').strip()
            curr_id = None
            if target:
                file_list = self.get_file_list()
                for item in file_list:
                    if item.get('id') == target or target.lower() in item.get('name', '').lower():
                        curr_id = item.get('id')
                        break
            if not curr_id:
                curr_id = self.get_current_file_id()
            
            file_data = self.get_file_data(curr_id) if curr_id else None
            root_node = extract_root_node(file_data)
            if not root_node:
                return "无法读取导图内容进行体检。请确保思维导图已保存并处于开启状态。"

            outline = "\n".join(node_to_markdown(root_node, 1, 6))
            focus = f"\n用户要求重点审视分支：{args.get('focus_topic')}\n" if args.get('focus_topic') else ""
            
            prompt = f"""【思维导图学术审校与逻辑体检任务】
以下是学生当前的思维导图知识大纲：
```markdown
{outline}
```
{focus}
【严苛审校铁律（绝不可代写）】：
1. 严禁替学生补全任何缺失内容，严禁直接生成补全后的子节点；
2. 围绕 4 大维度进行穿透式诊断：
   - [事实硬伤]：定义、公式、定理、符号或条件是否错误？
   - [层级倒置]：是否把并列关系写成从属、或把特例写在普遍原理之上？
   - [前提缺失]：推导过程是否出现逻辑跳跃，遗漏了核心成立边界（如限定条件）？
   - [易混概念]：是否把看似相似但机理不同的概念划了等号（如把“内能”当成“热量”）？
3. 对每个发现的问题，给出明确指出节点名称、指出认知漏洞、并提出启发式自查思考题，引导学生自主去修改思维导图！"""
            return prompt

        elif name == 'generate_socratic_quiz':
            curr_id = self.get_current_file_id()
            file_data = self.get_file_data(curr_id) if curr_id else None
            root_node = extract_root_node(file_data)
            if not root_node:
                return "无法读取当前导图生成考题。"

            outline = "\n".join(node_to_markdown(root_node, 1, 6))
            q_type = args.get('question_type', 'all')
            type_desc = {
                'essence': '【溯源本质题】：考查核心定义的内涵、成立前提与必要边界条件',
                'derivation': '【逻辑推导题】：考查从父节点推导至子节点或兄弟节点之间的关键因果推导链',
                'counterexample': '【边界反例题】：考查反常极端情境、常见陷阱、反例或思维定式辨析',
                'all': '从【溯源本质】、【逻辑推导】、【边界反例】中任选最具挑战性的 1~2 道考题'
            }.get(q_type, '综合考查')

            return f"""【思维导图苏格拉底式自动深度拷问任务】
参考学生导图大纲：
```markdown
{outline}
```
考题要求：
1. 目标类型：{type_desc}
2. 严厉风格：请扮演严苛的高考/学术主考官，直击思维薄弱点；
3. 提问规范：直接提出一道富有深度、必须动脑推导的情境问题，严禁在题干中直接透露答案！等待学生作答。"""

        elif name == 'get_review_progress':
            review_data = self.get_review_data()
            cards = review_data.get('cards') or review_data.get('reviewCards') or []
            if not cards:
                return "当前导图中尚未加入任何复习卡片，暂无 SM-2 进度记录。"
            
            total = len(cards)
            forgot_count = sum(1 for c in cards if c.get('repetition', 0) == 0 or c.get('grade', 0) <= 1)
            mastered_count = sum(1 for c in cards if c.get('interval', 0) >= 15)
            
            return f"### 复习记忆大盘统计：\n- 📚 总复习节点/卡片数：{total}\n- ⚠️ 待加固薄弱/错题节点数：{forgot_count}\n- 🌟 长期稳固掌握节点数：{mastered_count}\n数据已与本地 SM-2 间隔复习系统同步。"

        return f"未知工具名: {name}"

    def handle_rpc(self, req_data):
        """处理来自 Gemini 的 JSON-RPC 2.0 请求"""
        req_id = req_data.get('id')
        method = req_data.get('method')
        params = req_data.get('params') or {}

        if method == 'initialize':
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {"listChanged": False},
                        "resources": {"subscribe": False, "listChanged": False},
                        "prompts": {"listChanged": False}
                    },
                    "serverInfo": {
                        "name": "ReviewMind-MCP-Server",
                        "version": "1.4.9"
                    }
                }
            }

        elif method == 'notifications/initialized':
            # 客户端通知无需响应体，但返回空对象便于统一
            return None

        elif method == 'ping':
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {}
            }

        elif method == 'tools/list':
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "tools": self.list_tools()
                }
            }

        elif method == 'tools/call':
            tool_name = params.get('name')
            tool_args = params.get('arguments') or {}
            result_text = self.call_tool(tool_name, tool_args)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": str(result_text)
                        }
                    ],
                    "isError": False
                }
            }

        elif method == 'resources/list':
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "resources": []
                }
            }

        elif method == 'prompts/list':
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "prompts": []
                }
            }

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }
