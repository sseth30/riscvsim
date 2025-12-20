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

const symbols: Record<string, number> = {};
export function parseProgram(src: string): Program {
  const sourceLines = src.split("\n");
  const instructions: Inst[] = [];

  for (let i = 0; i < sourceLines.length; i++) {
    const raw = sourceLines[i];
    const rawTrim = raw.trim();
    if (rawTrim.startsWith("#sym")) {
      // formats: #sym name=1234  OR  #sym name 1234
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

    const tokens = line.replace(/,/g, " ").replace(/\s+/g, " ").trim().split(" ");
    const op = tokens[0].toLowerCase();

    if (op === "addi") {
      if (tokens.length !== 4) throw new Error(`Bad addi on line ${i + 1}`);
      instructions.push({
        op: "addi",
        rd: parseReg(tokens[1]),
        rs1: parseReg(tokens[2]),
        imm: parseImm(tokens[3]),
        srcLine: i,
      });
      continue;
    }

    if (op === "lw") {
      if (tokens.length !== 3) throw new Error(`Bad lw on line ${i + 1}`);
      const { imm, rs1 } = parseOffsetBase(tokens[2], i);
      instructions.push({
        op: "lw",
        rd: parseReg(tokens[1]),
        rs1,
        imm,
        srcLine: i,
      });
      continue;
    }

    if (op === "sw") {
      if (tokens.length !== 3) throw new Error(`Bad sw on line ${i + 1}`);
      const { imm, rs1 } = parseOffsetBase(tokens[2], i);
      instructions.push({
        op: "sw",
        rs2: parseReg(tokens[1]),
        rs1,
        imm,
        srcLine: i,
      });
      continue;
    }

    throw new Error(`Unsupported instruction "${op}" on line ${i + 1}`);
  }

  return { instructions, sourceLines, symbols };
}
