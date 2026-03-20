export type WorkbenchSectionKey = "workspace" | "templates" | "history";

export type WorkbenchNavSection = {
  key: WorkbenchSectionKey;
  title: string;
  description: string;
};

export type CapabilityKind = "available" | "reserved";

export type CapabilityItem = {
  key: string;
  title: string;
  description: string;
  kind: CapabilityKind;
  /**
   * Example prompts only. Reserved capabilities MUST NOT be described as shipped features.
   */
  examplePrompts: string[];
  note?: string;
};

export type CapabilityGroup = {
  key: string;
  title: string;
  description: string;
  items: CapabilityItem[];
};

export type ScenarioPromptChip = {
  key: string;
  label: string;
  prompt: string;
};

export type WorkbenchCatalog = {
  navigation: WorkbenchNavSection[];
  capabilityGroups: CapabilityGroup[];
  scenarioPromptChips: ScenarioPromptChip[];
  suggestedNextPrompts: string[];
};

const RESERVED_NOTE = "预留：仅提供示例提示词，不承诺已实现。";

export const workbenchCatalog: WorkbenchCatalog = {
  navigation: [
    {
      key: "workspace",
      title: "工作台",
      description: "围绕当前 Excel 的预览、计划、执行与结果回看。",
    },
    {
      key: "templates",
      title: "模板",
      description: "用示例提示词快速开始。仅做输入辅助，不承诺新增能力。",
    },
    {
      key: "history",
      title: "最近任务",
      description: "查看并切换最近执行过的任务结果。",
    },
  ],
  capabilityGroups: [
    {
      key: "cleanup",
      title: "数据清洗",
      description: "优先使用确定性规则，结果可预览、可回看、可导出。",
      items: [
        {
          key: "trim",
          title: "去空格与规范化",
          description: "清理常见输入问题，例如前后空格、格式不一致。",
          kind: "available",
          examplePrompts: ["去掉手机号前后空格。", "把金额列统一保留两位小数。"],
        },
        {
          key: "dedupe",
          title: "去重与删除",
          description: "按列去重、删除空值行等。",
          kind: "available",
          examplePrompts: ["删除手机号为空的行，并按手机号去重，保留首条记录。"],
        },
      ],
    },
    {
      key: "compute",
      title: "数据运算",
      description: "衍生列与映射类操作，必要时可使用 AI 辅助提取。",
      items: [
        {
          key: "derive",
          title: "衍生新列",
          description: "从现有列提取或生成新列，例如从地址提取省份。",
          kind: "available",
          examplePrompts: ["从地址列提取省份，输出到新列“省份”。"],
        },
        {
          key: "map",
          title: "值映射",
          description: "把同义值统一映射为标准值。",
          kind: "available",
          examplePrompts: ["把“男/男性/M”统一映射为“男”，把“女/女性/F”统一映射为“女”。"],
        },
      ],
    },
    {
      key: "analysis",
      title: "数据分析",
      description: "本轮不交付分析引擎能力，只提供提示词示例作为预留。",
      items: [
        {
          key: "analysis-reserved",
          title: "分析类示例提示词",
          description: "仅示例提示词，不代表系统已实现分析能力。",
          kind: "reserved",
          note: RESERVED_NOTE,
          examplePrompts: [
            "预留：请先帮我总结这份表格包含哪些字段，并建议我下一步可以做哪些清洗操作。",
            "预留：我想做趋势分析，但本轮只需要你帮我把日期列格式统一并补齐缺失值。",
          ],
        },
      ],
    },
    {
      key: "charts",
      title: "图表生成",
      description: "本轮不交付图表生成能力，只提供提示词示例作为预留。",
      items: [
        {
          key: "chart-reserved",
          title: "图表类示例提示词",
          description: "仅示例提示词，不代表系统已实现图表能力。",
          kind: "reserved",
          note: RESERVED_NOTE,
          examplePrompts: [
            "预留：我想做柱状图，但本轮只需要先把金额列清洗为数值并统一两位小数。",
          ],
        },
      ],
    },
  ],
  scenarioPromptChips: [
    {
      key: "salary",
      label: "员工工资整理",
      prompt: "去掉手机号前后空格，把金额列保留两位小数，并从地址列提取省份到新列。",
    },
    {
      key: "orders",
      label: "订单管理",
      prompt: "删除手机号为空的行，并按手机号去重，保留首条记录。",
    },
    {
      key: "traffic",
      label: "流量趋势准备",
      prompt: "把日期列统一为 YYYY-MM-DD 格式，并删除日期为空的行。",
    },
    {
      key: "scores",
      label: "成绩整理",
      prompt: "把分数列统一为数值并保留 1 位小数，删除分数为空的行。",
    },
    {
      key: "ads",
      label: "广告渠道整理",
      prompt: "把渠道列的同义值统一映射为标准渠道名称，并删除渠道为空的行。",
    },
  ],
  suggestedNextPrompts: [
    "再把手机号按统一格式处理，例如去空格、去横线。",
    "把金额列统一为两位小数，并检查异常值。",
    "从地址列提取省份到新列，方便后续筛选。",
  ],
};
