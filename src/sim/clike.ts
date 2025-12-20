import type { Program, Inst } from "./types";

function hex32(n: number) {
  return "0x" + (n >>> 0).toString(16).padStart(8, "0");
}

function invSymbols(program: Program): Map<number, string> {
  const m = new Map<number, string>();
  const syms = program.symbols ?? {};
  for (const [name, addr] of Object.entries(syms)) m.set(addr | 0, name);
  return m;
}

function fmtAddr(inv: Map<number, string>, addr: number) {
  return inv.get(addr) ?? hex32(addr);
}

const abiNames = [
  "zero","ra","sp","gp","tp","t0","t1","t2","s0/fp","s1",
  "a0","a1","a2","a3","a4","a5","a6","a7",
  "s2","s3","s4","s5","s6","s7","s8","s9","s10","s11",
  "t3","t4","t5","t6"
];

function r(i: number) {
  return abiNames[i] ? `${abiNames[i]}` : `x${i}`;
}

export function cLikeExplain(program: Program): string {
  const inv = invSymbols(program);

  // Track simple constants: reg -> constant value when known
  const regConst = new Map<number, number>();

  // Track: reg holds value loaded from *(addrOfPointerVar)
  // Example: lw t4, 0(t1) where t1 == 1004 (numPtr address)
  // means t4 holds numPtr's pointer value
  const regPtrFromVar = new Map<number, number>(); // reg -> addrOfPointerVar

  const lines: string[] = [];
  const insts = program.instructions;

  for (let i = 0; i < insts.length; i++) {
    const ins = insts[i];

    if (ins.op === "addi") {
      if (ins.rs1 === 0) {
        regConst.set(ins.rd, ins.imm | 0);
        lines.push(`${r(ins.rd)} = ${ins.imm};`);
      } else {
        regConst.delete(ins.rd);
        lines.push(`${r(ins.rd)} = ${r(ins.rs1)} + ${ins.imm};`);
      }
      continue;
    }

    if (ins.op === "lw") {
      const baseConst = regConst.get(ins.rs1);
      regConst.delete(ins.rd);

      if (baseConst !== undefined && ins.imm === 0) {
        // rd = *(baseConst)
        lines.push(`${r(ins.rd)} = *(int32_t*)${fmtAddr(inv, baseConst)};`);

        // remember rd holds the pointer stored at that address
        regPtrFromVar.set(ins.rd, baseConst);
      } else {
        regPtrFromVar.delete(ins.rd);
        lines.push(`${r(ins.rd)} = *(int32_t*)(${r(ins.rs1)} + ${ins.imm});`);
      }
      continue;
    }

    if (ins.op === "sw") {
        const baseConst = regConst.get(ins.rs1);
        const valConst = regConst.get(ins.rs2);
      
        // Pattern: *numPtr = value
        const ptrVarAddr = regPtrFromVar.get(ins.rs1);
        if (ptrVarAddr !== undefined && ins.imm === 0) {
          const ptrName = fmtAddr(inv, ptrVarAddr);
          const rhs = valConst !== undefined ? String(valConst) : r(ins.rs2);
          lines.push(`*${ptrName} = ${rhs};`);
          regPtrFromVar.delete(ins.rs2);
          continue;
        }
      
        // Pattern: numPtr = &num
        if (baseConst !== undefined && ins.imm === 0) {
            const baseName = fmtAddr(inv, baseConst);
            const rs2Const = valConst;
            if (rs2Const !== undefined) {
              const rhsName = fmtAddr(inv, rs2Const);
              lines.push(`*(int32_t*)${baseName} = (int32_t)${rhsName};`);
            } else {
              lines.push(`*(int32_t*)${baseName} = ${r(ins.rs2)};`);
            }
            regPtrFromVar.delete(ins.rs2);
            continue;
          }
      
        // Fallback
        lines.push(`*(int32_t*)(${r(ins.rs1)} + ${ins.imm}) = ${r(ins.rs2)};`);
        continue;
      }
      

    lines.push(`/* unsupported in C-like view */`);
  }

  return lines.join("\n");
}
