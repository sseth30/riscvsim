import { Program, Inst } from "./types";

const reg = (s: string) =>
  s.startsWith("x") ? Number(s.slice(1)) : (() => { throw new Error("Bad reg"); })();

export function parseProgram(src: string): Program {
  const lines = src.split("\n");
  const instructions: Inst[] = [];

  lines.forEach((line, i) => {
    line = line.split("#")[0].trim();
    if (!line) return;

    const t = line.replace(/,/g, "").split(/\s+/);
    if (t[0] === "addi") {
      instructions.push({ op: "addi", rd: reg(t[1]), rs1: reg(t[2]), imm: Number(t[3]), srcLine: i });
    }
    if (t[0] === "lw") {
      const [imm, r] = t[2].split("(");
      instructions.push({ op: "lw", rd: reg(t[1]), rs1: reg(r.slice(0, -1)), imm: Number(imm), srcLine: i });
    }
    if (t[0] === "sw") {
      const [imm, r] = t[2].split("(");
      instructions.push({ op: "sw", rs2: reg(t[1]), rs1: reg(r.slice(0, -1)), imm: Number(imm), srcLine: i });
    }
  });

  return { instructions, sourceLines: lines };
}
