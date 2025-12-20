import type { Program, Inst } from "./types";

const regAliases: Record<string, number> = {
  zero: 0, ra: 1, sp: 2, gp: 3, tp: 4,
  t0: 5, t1: 6, t2: 7,
  s0: 8, fp: 8, s1: 9,
  a0: 10, a1: 11, a2: 12, a3: 13, a4: 14, a5: 15, a6: 16, a7: 17,
  s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23, s8: 24, s9: 25, s10: 26, s11: 27,
  t3: 28, t4: 29, t5: 30, t6: 31,
};

function parseReg(tok: string): number {
  const t = tok.trim().toLowerCase();
  if (t.startsWith("x")) {
    const n = Number(t.slice(1));
    if (Number.isInteger(n) && n >= 0 && n <= 31) return n;
  }
  if (t in regAliases) return regAliases[t];
  throw new Error(`Bad register: ${tok}`);
}

function parseImm(tok: string): number {
  const t = tok.trim().toLowerCase();
  const v = t.startsWith("0x") ? parseInt(t, 16) : parseInt(t, 10);
  if (!Number.isFinite(v)) throw new Error(`Bad immediate: ${tok}`);
  return v | 0;
}

function stripComment(line: string) {
  const i = line.indexOf("#");
  return (i >= 0 ? line.slice(0, i) : line).trim();
}

function parseOffsetBase(expr: string, srcLine: number) {
  const m = expr.trim().match(/^(-?(?:0x[0-9a-fA-F]+|\d+))\(([^)]+)\)$/);
  if (!m) throw new Error(`Bad mem operand on line ${srcLine + 1}: ${expr}`);
  return { imm: parseImm(m[1]), rs1: parseReg(m[2]) };
}

export function parseProgram(src: string): Program {
  const sourceLines = src.split("\n");
  const instructions: Inst[] = [];
  const symbols: Record<string, number> = {};
  const labels: Record<string, number> = {};
  const pending: { line: string; srcLine: number }[] = [];

  let pc = 0;
  for (let i = 0; i < sourceLines.length; i++) {
    const raw = sourceLines[i];
    const rawTrim = raw.trim();
    if (rawTrim.startsWith("#sym")) {
      const rest = rawTrim.slice(4).trim();
      const m1 = rest.match(/^([A-Za-z_]\w*)\s*=\s*(0x[0-9a-fA-F]+|\d+)$/);
      const m2 = rest.match(/^([A-Za-z_]\w*)\s+(0x[0-9a-fA-F]+|\d+)$/);
      const m = m1 ?? m2;
      if (!m) throw new Error(`Bad #sym format on line ${i + 1}`);
      symbols[m[1]] = m[2].toLowerCase().startsWith("0x") ? parseInt(m[2], 16) : parseInt(m[2], 10);
      continue;
    }
    const line = stripComment(raw);
    if (!line) continue;

    let rest = line.trim();
    while (true) {
      const m = rest.match(/^([A-Za-z_]\w*):\s*(.*)$/);
      if (!m) break;
      const [, label, after] = m;
      if (labels[label] !== undefined) throw new Error(`Duplicate label "${label}" on line ${i + 1}`);
      labels[label] = pc;
      rest = after;
    }

    if (!rest.trim()) continue;
    pending.push({ line: rest.trim(), srcLine: i });
    pc += 4;
  }

  const parseTargetPC = (tok: string, srcLine: number) => {
    if (labels[tok] !== undefined) return labels[tok];
    if (symbols[tok] !== undefined) return symbols[tok];
    if (/^[A-Za-z_]\w*$/.test(tok)) throw new Error(`Unknown label "${tok}" on line ${srcLine + 1}`);
    const pcVal = parseImm(tok);
    if (pcVal % 4 !== 0) throw new Error(`Branch target must be word-aligned on line ${srcLine + 1}`);
    return pcVal;
  };

  for (const { line, srcLine } of pending) {
    const tokens = line.replace(/,/g, " ").replace(/\s+/g, " ").trim().split(" ");
    const op = tokens[0].toLowerCase();

    if (op === "addi") {
      if (tokens.length !== 4) throw new Error(`Bad addi on line ${srcLine + 1}`);
      instructions.push({
        op: "addi",
        rd: parseReg(tokens[1]),
        rs1: parseReg(tokens[2]),
        imm: parseImm(tokens[3]),
        srcLine,
      });
      continue;
    }

    if (op === "lw") {
      if (tokens.length !== 3) throw new Error(`Bad lw on line ${srcLine + 1}`);
      const { imm, rs1 } = parseOffsetBase(tokens[2], srcLine);
      instructions.push({
        op: "lw",
        rd: parseReg(tokens[1]),
        rs1,
        imm,
        srcLine,
      });
      continue;
    }

    if (op === "sw") {
      if (tokens.length !== 3) throw new Error(`Bad sw on line ${srcLine + 1}`);
      const { imm, rs1 } = parseOffsetBase(tokens[2], srcLine);
      instructions.push({
        op: "sw",
        rs2: parseReg(tokens[1]),
        rs1,
        imm,
        srcLine,
      });
      continue;
    }

    if (op === "beq") {
      if (tokens.length !== 4) throw new Error(`Bad beq on line ${srcLine + 1}`);
      instructions.push({
        op: "beq",
        rs1: parseReg(tokens[1]),
        rs2: parseReg(tokens[2]),
        targetPC: parseTargetPC(tokens[3], srcLine),
        srcLine,
      });
      continue;
    }

    throw new Error(`Unsupported instruction "${op}" on line ${srcLine + 1}`);
  }

  return { instructions, sourceLines, symbols, labels };
}
