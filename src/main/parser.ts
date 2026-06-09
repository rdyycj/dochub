// Direct parser — runs in main process, no worker threads needed
import * as fs from 'fs';
import { ParserResult } from '../shared/types';

// Lazy-loadable modules
let pdfParse: any;
let mammoth: any;
let XLSX: any;
let pptxParser: any;
let nodejieba: any;

function ensureModules(): void {
  try { if (!pdfParse) pdfParse = require('pdf-parse'); } catch {}
  try { if (!mammoth) mammoth = require('mammoth'); } catch {}
  try { if (!XLSX) XLSX = require('xlsx'); } catch {}
  try { if (!pptxParser) pptxParser = require('pptx-parser'); } catch {}
  try { if (!nodejieba) nodejieba = require('nodejieba'); } catch {}
}

export async function parseFileDirect(filePath: string, ext: string): Promise<Omit<ParserResult, 'fileId'>> {
  ensureModules();
  const maxSizeBytes = 100 * 1024 * 1024;

  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxSizeBytes) {
      return { text: '', tokens: [], error: '文件过大，跳过内容解析' };
    }
  } catch (e: any) {
    return { text: '', tokens: [], error: `无法访问文件: ${e.message}` };
  }

  let text = '';
  let error: string | undefined;
  let encrypted: boolean | undefined;

  switch (ext.toLowerCase()) {
    case '.pdf': {
      try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        text = data.text || '';
        if (text.trim().length === 0) {
          error = '纯图片PDF，无法提取文本';
        }
      } catch (e: any) {
        if (e.message?.includes('password') || e.message?.includes('encrypted')) {
          return { text: '', tokens: [], encrypted: true, error: '加密文档' };
        }
        return { text: '', tokens: [], error: `PDF解析失败: ${e.message}` };
      }
      break;
    }

    case '.doc':
      return { text: '', tokens: [], error: '旧版Word(.doc)，仅按文件名分类' };

    case '.docx': {
      try {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch (e: any) {
        return { text: '', tokens: [], error: `Word解析失败: ${e.message}` };
      }
      break;
    }

    case '.xls':
    case '.xlsx': {
      try {
        const workbook = XLSX.readFile(filePath);
        const texts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          texts.push(csv);
        }
        text = texts.join('\n');
      } catch (e: any) {
        return { text: '', tokens: [], error: `Excel解析失败: ${e.message}` };
      }
      break;
    }

    case '.pptx': {
      try {
        const buffer = fs.readFileSync(filePath);
        const result = await pptxParser.parse(buffer);
        const texts: string[] = [];
        for (const slide of result.slides || []) {
          for (const shape of slide.shapes || []) {
            if (shape.text) texts.push(shape.text);
          }
        }
        text = texts.join('\n');
      } catch (e: any) {
        return { text: '', tokens: [], error: `PPT解析失败: ${e.message}` };
      }
      break;
    }

    default:
      return { text: '', tokens: [], error: `不支持的文件类型: ${ext}` };
  }

  // Tokenize
  const tokens = tokenizeText(text);
  return { text, tokens, error, encrypted };
}

function tokenizeText(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  try {
    ensureModules();
    if (nodejieba) return nodejieba.cut(text);
  } catch {}
  return text.split(/\s+/).filter(Boolean);
}
