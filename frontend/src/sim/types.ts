export type Effect =
  | { kind: "reg"; reg: number; before: number; after: number }
  | { kind: "mem"; addr: number; size: number; beforeBytes: number[]; afterBytes: number[] }
  | { kind: "pc"; before: number; after: number };

export type ApiResponse = {
  sessionId?: string;
  pc?: number;
  regs?: number[];
  halted?: boolean;
  effects?: Effect[];
  clike?: string;
  rv2c?: string;
  error?: string;
};
