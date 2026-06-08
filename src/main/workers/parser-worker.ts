import { parentPort } from 'worker_threads';
import * as fs from 'fs';
import { ParserTask, ParserResult } from '../../shared/types';

// Lazy-load heavy parsers
let pdfParse: any;
let mammoth: any;
let XLSX: any;
let pptxParser: any;
let nodejieba: any;

function ensureParsers(): void {
  if (!pdfParse) pdfParse = require('pdf-parse');
  if (!mammoth) mammoth = require('mammoth');
  if (!XLSX) XLSX = require('xlsx');
  if (!pptxParser) pptxParser = require('pptx-parser');
  if (!nodejieba) nodejieba = require('nodejieba');
}

async function parseFile(filePath: string, ext: string): Promise<{ text: string; error?: string; encrypted?: boolean }> {
  ensureParsers();
  const maxSizeBytes = 100 * 1024 * 1024; // 100MB

  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxSizeBytes) {
      return { text: '', error: '文件过大，跳过内容解析' };
    }
  } catch (e: any) {
    return { text: '', error: `无法访问文件: ${e.message}` };
  }

  switch (ext.toLowerCase()) {
    case '.pdf': {
      try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const text = data.text || '';
        if (text.trim().length === 0) {
          return { text: '', error: '纯图片PDF，无法提取文本' };
        }
        return { text };
      } catch (e: any) {
        if (e.message?.includes('password') || e.message?.includes('encrypted')) {
          return { text: '', encrypted: true, error: '加密文档' };
        }
        return { text: '', error: `PDF解析失败: ${e.message}` };
      }
    }

    case '.docx': {
      try {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value };
      } catch (e: any) {
        return { text: '', error: `Word解析失败: ${e.message}` };
      }
    }

    case '.xlsx': {
      try {
        const workbook = XLSX.readFile(filePath);
        const texts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          texts.push(csv);
        }
        return { text: texts.join('\n') };
      } catch (e: any) {
        return { text: '', error: `Excel解析失败: ${e.message}` };
      }
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
        return { text: texts.join('\n') };
      } catch (e: any) {
        return { text: '', error: `PPT解析失败: ${e.message}` };
      }
    }

    default:
      return { text: '', error: `不支持的文件类型: ${ext}` };
  }
}

function tokenize(text: string): string[] {
  ensureParsers();
  if (!text || text.trim().length === 0) return [];
  try {
    return nodejieba.cut(text);
  } catch {
    // fallback: simple whitespace split
    return text.split(/\s+/).filter(Boolean);
  }
}

if (parentPort) {
  parentPort.on('message', async (task: ParserTask) => {
    const { filePath, fileId, ext } = task;
    const { text, error, encrypted } = await parseFile(filePath, ext);
    const tokens = tokenize(text);
    const result: ParserResult = { fileId, text, tokens, error, encrypted };
    parentPort!.postMessage(result);
  });
}
