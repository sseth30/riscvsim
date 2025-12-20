function check(mem: Uint8Array, addr: number, size: number) {
    if (addr < 0 || addr + size > mem.length) {
      throw new Error("Memory out of bounds");
    }
  }
  
  export function loadWord(mem: Uint8Array, addr: number): number {
    if (addr % 4 !== 0) throw new Error("Unaligned lw");
    check(mem, addr, 4);
    return (
      mem[addr] |
      (mem[addr + 1] << 8) |
      (mem[addr + 2] << 16) |
      (mem[addr + 3] << 24)
    );
  }
  
  export function storeWord(mem: Uint8Array, addr: number, val: number) {
    if (addr % 4 !== 0) throw new Error("Unaligned sw");
    check(mem, addr, 4);
  
    const before = mem.slice(addr, addr + 4);
    mem[addr] = val & 0xff;
    mem[addr + 1] = (val >>> 8) & 0xff;
    mem[addr + 2] = (val >>> 16) & 0xff;
    mem[addr + 3] = (val >>> 24) & 0xff;
    const after = mem.slice(addr, addr + 4);
  
    return { before: [...before], after: [...after] };
  }
  