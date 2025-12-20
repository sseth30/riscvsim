import type { CPUState, Program, StepResult, Effect } from "./types";
import { loadWord, storeWord } from "./memory";

export function createState(): CPUState {
  const mem = new Uint8Array(64 * 1024);
  const regs = new Int32Array(32);
  regs[2] = mem.length - 4; // sp
  return { pc: 0, regs, mem };
}

export function step(state: CPUState, program: Program): StepResult {
  const idx = state.pc >>> 2;
  if (idx >= program.instructions.length) {
    return { inst: program.instructions[idx - 1], effects: [], halted: true };
  }

  const inst = program.instructions[idx];
  const effects: Effect[] = [];
  const r = state.regs;
  const pc0 = state.pc;

  const writeReg = (i: number, v: number) => {
    if (i === 0) return;
    const before = r[i];
    r[i] = v | 0;
    effects.push({ kind: "reg", reg: i, before, after: r[i] });
  };

  if (inst.op === "addi") {
    writeReg(inst.rd, r[inst.rs1] + inst.imm);
    state.pc += 4;
  }

  if (inst.op === "lw") {
    const addr = r[inst.rs1] + inst.imm;
    writeReg(inst.rd, loadWord(state.mem, addr));
    state.pc += 4;
  }

  if (inst.op === "sw") {
    const addr = r[inst.rs1] + inst.imm;
    const { before, after } = storeWord(state.mem, addr, r[inst.rs2]);
    effects.push({ kind: "mem", addr, size: 4, before, after });
    state.pc += 4;
  }

  effects.push({ kind: "pc", before: pc0, after: state.pc });
  r[0] = 0;

  return { inst, effects, halted: false };
}
