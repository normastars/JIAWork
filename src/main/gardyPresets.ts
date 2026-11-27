import fs from 'node:fs';
import path from 'node:path';

import { AgentAvatarSvg, encodeAgentAvatarIcon } from '../shared/agent/avatar';
import {
  type ExpertCatalog,
  ExpertCatalogSchemaVersion,
  ExpertScenarioAccent,
  type PresetAgent,
} from '../shared/agent/presets';

export const GardyPresetAgentId = {
  SpreadsheetAnalyst: 'gardy-spreadsheet-analyst',
  DocumentAssistant: 'gardy-document-assistant',
  WorkSummaryAssistant: 'gardy-work-summary-assistant',
} as const;

export const resolveGardyPromptDir = (moduleDir: string): string | undefined => [
  path.resolve(moduleDir, '../resources/gardy-prompts'),
  path.resolve(moduleDir, '../../resources/gardy-prompts'),
  path.resolve(moduleDir, '../../../resources/gardy-prompts'),
].find(candidate => fs.existsSync(candidate));

function readGardyPrompt(fileName: string): string {
  const promptDir = resolveGardyPromptDir(__dirname);
  if (!promptDir) throw new Error('GARDY prompt files are missing from the application package.');
  return fs.readFileSync(path.join(promptDir, fileName), 'utf8').trim();
}

const spreadsheetPrompt = readGardyPrompt('spreadsheet-analyst.md');
const documentPrompt = readGardyPrompt('document-assistant.md');
const summaryPrompt = readGardyPrompt('work-summary-assistant.md');

export const PRESET_AGENTS: PresetAgent[] = [
  {
    id: GardyPresetAgentId.SpreadsheetAnalyst,
    name: '表格分析专家',
    nameEn: 'Spreadsheet Analysis Expert',
    icon: encodeAgentAvatarIcon({ svg: AgentAvatarSvg.Data }),
    description: '整理嘉迪业务表格、核对数据质量、分析指标并制作工作簿。',
    descriptionEn: 'Analyze GARDY business spreadsheets and produce reviewable workbooks.',
    identity: '你是嘉迪团队的表格分析专家，擅长整理业务台账、核对数据质量、分析指标并制作清晰可靠的 Excel 工作簿。你以用户提供的字段定义、统计口径和模板为准，不自行补写业务规则。',
    identityEn: 'You are GARDY\'s spreadsheet analysis expert. You organize operational records, validate data quality, analyze metrics, and produce clear, reliable Excel workbooks. Follow the field definitions, calculation rules, and templates supplied by the user without inventing business rules.',
    systemPrompt: spreadsheetPrompt,
    systemPromptEn: spreadsheetPrompt,
    skillIds: ['xlsx', 'gardy-inventory'],
    category: 'gardy',
    tags: [{ zh: '数据分析', en: 'Data analysis' }],
    starterPrompts: [{ zh: '帮我分析这份表格', en: 'Analyze this spreadsheet' }],
    revision: 1,
  },
  {
    id: GardyPresetAgentId.DocumentAssistant,
    name: '文档专家',
    nameEn: 'Document Expert',
    icon: encodeAgentAvatarIcon({ svg: AgentAvatarSvg.Document }),
    description: '阅读、起草和审校嘉迪业务文档，保留来源与待确认信息。',
    descriptionEn: 'Read, draft, and review GARDY business documents with source traceability.',
    identity: '你是嘉迪团队的文档专家，负责从业务材料中准确提取信息，并协助起草、审校和整理专业文档。你尊重现有模板和原文事实，对未确认的信息明确标注，不擅自设定制度或流程。',
    identityEn: 'You are GARDY\'s document expert. You accurately extract information from business materials and help draft, review, and organize professional documents. Respect existing templates and source facts, clearly flag unconfirmed information, and do not invent policies or procedures.',
    systemPrompt: documentPrompt,
    systemPromptEn: documentPrompt,
    skillIds: ['docx', 'pdf'],
    category: 'gardy',
    tags: [{ zh: '文档', en: 'Documents' }],
    starterPrompts: [{ zh: '根据这些材料起草文档', en: 'Draft a document from these materials' }],
    revision: 1,
  },
  {
    id: GardyPresetAgentId.WorkSummaryAssistant,
    name: '工作总结专家',
    nameEn: 'Work Summary Expert',
    icon: encodeAgentAvatarIcon({ svg: AgentAvatarSvg.Briefcase }),
    description: '汇总日报、周报和项目材料，提炼成果、问题与下一步计划。',
    descriptionEn: 'Summarize updates into outcomes, issues, and next steps.',
    identity: '你是嘉迪团队的工作总结专家，擅长把零散记录、会议材料和业务数据整理成重点清晰、事实可靠的工作总结。你突出成果和进展，也如实呈现问题、风险、下一步计划及需要协调的事项。',
    identityEn: 'You are GARDY\'s work summary expert. You turn scattered notes, meeting materials, and business data into focused, fact-based work summaries. Highlight results and progress while accurately presenting issues, risks, next steps, and coordination needs.',
    systemPrompt: summaryPrompt,
    systemPromptEn: summaryPrompt,
    skillIds: ['docx', 'xlsx', 'pptx'],
    category: 'gardy',
    tags: [{ zh: '汇报', en: 'Reporting' }],
    starterPrompts: [{ zh: '把这些记录整理成周报', en: 'Turn these notes into a weekly report' }],
    revision: 1,
  },
];

export function getGardyExpertCatalog(): ExpertCatalog {
  return {
    schemaVersion: ExpertCatalogSchemaVersion,
    version: 'gardy-1',
    categories: [{ id: 'gardy', label: { zh: '嘉迪专家', en: 'GARDY Experts' } }],
    scenarios: [{
      id: 'gardy-work',
      title: { zh: '嘉迪工作', en: 'GARDY Work' },
      description: { zh: '表格、文档与工作汇报', en: 'Spreadsheets, documents, and reports' },
      accent: ExpertScenarioAccent.Teal,
      expertIds: PRESET_AGENTS.map(preset => preset.id),
    }],
    experts: PRESET_AGENTS,
  };
}
