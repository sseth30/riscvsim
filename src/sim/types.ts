export type Effect =
  | { kind: "reg"; reg: number; before: number; after: number }
  | { kind: "mem"; addr: number; size: number; before: number[]; after: number[] }
  | { kind: "pc"; before: number; after: number };

export type Inst =
  | { op: "addi"; rd: number; rs1: number; imm: number; srcLine: number }
  | { op: "lw"; rd: number; rs1: number; imm: number; srcLine: number }
  | { op: "sw"; rs2: number; rs1: number; imm: number; srcLine: number };

  export type Program = {
    instructions: Inst[];
    sourceLines: string[];
    symbols?: Record<string, number>;
  };

export type CPUState = {
  pc: number;
  regs: Int32Array;
  mem: Uint8Array;
};

export type StepResult = {
  inst: Inst;
  effects: Effect[];
  halted: boolean;
};
