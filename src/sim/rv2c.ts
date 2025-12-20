import type { Program, Inst } from "./types";

function hex(n: number) {
  return "0x" + (n >>> 0).toString(16);
}

function buildLabelMap(program: Program): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const [name, pc] of Object.entries(program.labels ?? {})) {
    if (!m.has(pc)) m.set(pc, []);
    m.get(pc)!.push(name);
  }
  return m;
}

function firstLabelForPc(labelMap: Map<number, string[]>, pc: number) {
  const names = labelMap.get(pc);
  return names?.[0];
}

function instToC(inst: Inst, asm: string): string[] {
  const c: string[] = [];
  c.push(`// ${asm.trim()}`);

  switch (inst.op) {
    case "addi":
      c.push(`x[${inst.rd}] = (int32_t)(x[${inst.rs1}] + ${inst.imm});`);
      break;

    case "lw":
      c.push(`x[${inst.rd}] = load32(mem, (uint32_t)(x[${inst.rs1}] + ${inst.imm}));`);
      break;

    case "sw":
      c.push(`store32(mem, (uint32_t)(x[${inst.rs1}] + ${inst.imm}), x[${inst.rs2}]);`);
      break;

    default:
      c.push(`/* unsupported in mapper: ${(inst as any).op} */`);
      break;
  }

  return c;
}

export function rvToC(program: Program, memSize = 64 * 1024): string {
  const lines: string[] = [];
  const labelMap = buildLabelMap(program);

  lines.push(`#include <stdint.h>`);
  lines.push(`#include <string.h>`);
  lines.push(``);
  lines.push(`// Auto-generated "C mapping" of a small RV32 subset.`);
  lines.push(`// This is not high-level decompilation. It is a semantic translation.`);
  lines.push(``);
  lines.push(`static inline int32_t load32(uint8_t *mem, uint32_t addr) {`);
  lines.push(`  int32_t v;`);
  lines.push(`  memcpy(&v, mem + addr, 4);`);
  lines.push(`  return v;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`static inline void store32(uint8_t *mem, uint32_t addr, int32_t v) {`);
  lines.push(`  memcpy(mem + addr, &v, 4);`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`int main(void) {`);
  lines.push(`  static uint8_t mem[${memSize}];`);
  lines.push(`  static int32_t x[32];`);
  lines.push(`  uint32_t pc = 0;`);
  lines.push(``);
  lines.push(`  // Initialize SP near top of memory (like our simulator)`);
  lines.push(`  x[2] = ${memSize - 4};`);
  lines.push(``);
  lines.push(`  // Step-by-step execution modeled as a PC switch`);
  lines.push(`  while (1) {`);
  lines.push(`    x[0] = 0;`);
  lines.push(`    switch (pc) {`);

  for (let i = 0; i < program.instructions.length; i++) {
    const inst = program.instructions[i];
    const pcVal = i * 4;
    const asm = program.sourceLines[inst.srcLine] ?? "";
    const labelHere = labelMap.get(pcVal);
    lines.push(`      case ${pcVal}: {`);
    if (labelHere?.length) {
      lines.push(`        // label: ${labelHere.join(", ")}`);
    }

    if (inst.op === "beq") {
      const targetLabel = firstLabelForPc(labelMap, inst.targetPC);
      const targetComment = ` // goto ${targetLabel ?? hex(inst.targetPC)}`;
      lines.push(`        // ${asm.trim()}`);
      lines.push(`        if (x[${inst.rs1}] == x[${inst.rs2}]) {`);
      lines.push(`          pc = ${inst.targetPC};${targetComment}`);
      lines.push(`        } else {`);
      lines.push(`          pc = ${pcVal + 4};`);
      lines.push(`        }`);
    } else {
      for (const stmt of instToC(inst, asm)) {
        lines.push(`        ${stmt}`);
      }
      lines.push(`        pc = ${pcVal + 4};`);
    }
    lines.push(`        break;`);
    lines.push(`      }`);
  }

  lines.push(`      default:`);
  lines.push(`        return 0;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}
