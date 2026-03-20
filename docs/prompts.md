# Excel to AI Prompt 设计文档

## 1. 目标

本文档用于固化 Excel to AI MVP 中 AI 交互的 prompt 规范，覆盖两类能力：

- `generatePlan`：将自然语言需求转换为结构化操作计划
- `transformCells`：对必须使用 AI 的字段按批次处理

目标不是让模型直接修改整份 Excel，而是让模型在明确边界内返回结构化结果。

---

## 2. 总体原则

### 2.1 AI 只做两件事

- 理解需求并输出 `AiPlan`
- 处理无法靠确定性规则完成的字段

### 2.2 AI 不做的事

- 不直接返回整份修改后的表格
- 不输出任意代码
- 不虚构不存在的列
- 不越权修改无关字段
- 不输出 Markdown 代码块

### 2.3 服务端职责

所有 prompt 由服务端组装，前端不参与 prompt 拼接。

服务端负责：

- 过滤输入上下文
- 控制发送给模型的列和样例
- 解析模型返回值
- 做 schema 校验
- 失败时决定是否重试

---

## 3. 模型分层建议

建议至少预留两套模型配置：

- `PLAN_MODEL`
- `CELL_MODEL`

即使 MVP 初期使用同一个模型，也应在代码结构上分离，避免后续难以替换。

环境变量建议：

```txt
AI_PROVIDER=openai_compatible
AI_BASE_URL=
AI_API_KEY=
PLAN_MODEL=
CELL_MODEL=
AI_TIMEOUT_MS=60000
AI_MAX_RETRIES=1
CELL_BATCH_SIZE=50
PLAN_SAMPLE_ROW_COUNT=10
```

---

## 4. Plan 生成 Prompt

## 4.1 目标

输入：

- 列名
- 样例数据
- 用户需求
- 可用操作白名单

输出：

- 合法的 `AiPlan` JSON

## 4.2 系统提示词

```txt
你是一个 Excel 数据处理规则生成器。

你的任务是根据用户需求，将表格处理意图转换为可执行的 JSON 操作计划。

你只能输出 JSON，不要输出任何解释、注释、Markdown 代码块或额外文本。

必须遵守以下规则：
1. 只允许使用 allowedOperations 中提供的操作类型。
2. 不允许虚构不存在的列名。
3. 如果需求描述不明确、样例不足或无法安全执行，请将问题写入 warnings。
4. 优先输出可程序执行的确定性规则。
5. 只有在无法用普通规则完成时，才使用 ai_transform 或 derive_column + ai_extract。
6. 不要输出任何代码。
7. 不要输出 null 作为占位值，无法确定时应减少该操作并写入 warnings。
8. summary 应简洁概括主要处理内容。
```

## 4.3 用户输入模板

```txt
输入信息：
- sheetName: {{sheetName}}
- totalRows: {{totalRows}}
- columns: {{columns}}
- sampleRows: {{sampleRows}}
- allowedOperations: {{allowedOperations}}
- userRequest: {{userRequest}}

输出结构：
{
  "summary": "",
  "operations": [],
  "warnings": []
}
```

## 4.4 建议发送给模型的 JSON 上下文

```json
{
  "sheetName": "Sheet1",
  "totalRows": 1000,
  "columns": ["姓名", "手机号", "地址", "金额"],
  "sampleRows": [
    {
      "__rowIndex": 2,
      "姓名": "张三",
      "手机号": " 13800138000 ",
      "地址": "广东省深圳市南山区",
      "金额": "12.5"
    }
  ],
  "allowedOperations": [
    "trim",
    "format_number",
    "delete_rows",
    "deduplicate",
    "map_values",
    "derive_column",
    "ai_transform"
  ],
  "userRequest": "去掉手机号空格，把金额保留两位小数，并新增省份列"
}
```

## 4.5 期望输出示例

```json
{
  "summary": "清洗手机号、格式化金额并提取省份",
  "operations": [
    { "type": "trim", "column": "手机号" },
    { "type": "format_number", "column": "金额", "digits": 2 },
    {
      "type": "derive_column",
      "sourceColumn": "地址",
      "targetColumn": "省份",
      "method": "ai_extract",
      "instruction": "从地址中提取省级行政区"
    }
  ],
  "warnings": []
}
```

## 4.6 不明确需求示例

用户需求：

```txt
帮我把状态整理一下
```

允许的安全输出：

```json
{
  "summary": "尝试整理状态字段",
  "operations": [],
  "warnings": [
    "未能明确识别需要处理的状态列，请用户指定列名或提供更明确的映射规则。"
  ]
}
```

---

## 5. 字段处理 Prompt

## 5.1 适用场景

仅在以下场景启用：

- 地址提取
- 商品标题精简
- 标签提取
- 评论分类
- 文本摘要
- 命名实体识别

对于 `trim`、`format_number`、`deduplicate`、`map_values` 等确定性任务，严禁调用字段 AI。

## 5.2 系统提示词

```txt
你是一个字段处理助手。

你只负责根据给定 instruction 处理输入字段值，并输出严格 JSON。

必须遵守以下规则：
1. 只处理 instruction 指定的目标。
2. 只返回 JSON，不要输出解释、注释、Markdown 代码块或额外文本。
3. 不修改无关字段。
4. 无法处理时，在 error 字段说明原因。
5. 不要编造不存在的信息。
6. 输出必须与要求的 schema 一致。
```

## 5.3 单值处理模板

```txt
输入：
{
  "instruction": "{{instruction}}",
  "value": "{{value}}"
}

输出结构：
{
  "result": "",
  "error": ""
}
```

说明：

- 正常返回时，`error` 为空字符串
- 无法处理时，`result` 为空字符串，`error` 说明原因

## 5.4 单值输出示例

输入：

```json
{
  "instruction": "从地址中提取省级行政区",
  "value": "广东省深圳市南山区科技园"
}
```

输出：

```json
{
  "result": "广东省",
  "error": ""
}
```

失败输出：

```json
{
  "result": "",
  "error": "地址为空，无法提取省级行政区"
}
```

---

## 6. 批处理 Prompt

## 6.1 目标

为了减少请求次数，字段处理可按批次发送，但必须保持逐条可映射。

## 6.2 系统提示词

```txt
你是一个批量字段处理助手。

请根据 instruction 对 batch 中每一项独立处理，并返回严格 JSON。

必须遵守以下规则：
1. 每条输入都必须在输出中保留对应 rowIndex。
2. 只处理指定字段值，不要补充无关信息。
3. 只输出 JSON，不要输出任何解释或 Markdown。
4. 无法处理的项请返回 error，不要省略。
5. 结果顺序应与输入顺序一致。
```

## 6.3 批处理输入模板

```json
{
  "instruction": "从地址中提取省级行政区",
  "batch": [
    { "rowIndex": 2, "value": "广东省深圳市南山区科技园" },
    { "rowIndex": 3, "value": "浙江省杭州市西湖区文三路" }
  ]
}
```

## 6.4 批处理输出模板

```json
{
  "results": [
    { "rowIndex": 2, "result": "广东省", "error": "" },
    { "rowIndex": 3, "result": "浙江省", "error": "" }
  ]
}
```

---

## 7. 服务端校验规则

## 7.1 Plan 响应校验

服务端必须校验：

- 返回是否为合法 JSON
- `summary` 是否为字符串
- `operations` 是否为数组
- `warnings` 是否为字符串数组
- `operation.type` 是否在白名单内
- 引用列是否存在
- `digits`、`mapping`、`condition` 等字段是否符合 schema

如果校验失败：

- 不执行
- 返回 `INVALID_AI_PLAN`
- 记录原始 AI 响应，供日志审查

## 7.2 Cell 响应校验

单值模式校验：

- `result` 必须存在
- `error` 必须存在

批量模式校验：

- `results` 必须为数组
- 每项必须包含 `rowIndex`、`result`、`error`
- `rowIndex` 必须能和输入 batch 对应

如果校验失败：

- 当前批次记为失败
- 可按需要重试一次
- 超过重试次数则记录失败行

---

## 8. 上下文裁剪策略

为了降低 token 和隐私风险，服务端应裁剪上下文：

### 8.1 生成计划时

- 默认只发送前 `10` 行有效样例
- 只发送当前 Sheet 的列名和样例
- 不发送整份文件
- 对特别长的单元格内容做长度截断，例如最多 `300` 字符

### 8.2 字段批处理时

- 只发送当前操作需要的列值
- 默认每批 `50` 行
- 对空值、超长值、异常值先在本地做预检查

---

## 9. 脱敏预留策略

MVP 首期不强制启用脱敏，但 prompt 设计应预留能力：

- 手机号可替换为部分掩码
- 身份证号可部分掩码
- 姓名可只保留姓氏
- 非必要列不传给模型

当启用脱敏模式时，应在 prompt 中明确告知模型输入可能已脱敏，避免误判。

---

## 10. 推荐实现方式

服务端建议实现两个 provider 方法：

```ts
generatePlan(input: GeneratePlanInput): Promise<AiPlan>
transformCells(input: TransformCellsInput): Promise<TransformCellsResult>
```

并把以下内容封装在 provider 内部：

- prompt 模板
- 模型选择
- JSON 解析
- schema 校验
- 重试逻辑
- provider 错误映射

这样业务层只关心“要什么结果”，不关心“怎么和模型对话”。
