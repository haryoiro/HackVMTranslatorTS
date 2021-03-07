import { WriteStream } from 'fs';
import { CommandElement } from './types';

/**
 * generateVariable
 * @param jump comp;jump のjumpニーモニック
 * @param uniqueId 一意の値を入力
 */
const genVar = (unique:string|number) => ({
  jif: `JIF${unique}`,
  jel: `JEL${unique}`,
  jfi: `JFI${unique}`,
})

let symbolId = 0
const genSymbolId = () => symbolId += 1

const SYMBOL: {
  [key:string]: { 0: string, offset: number }
} = Object.freeze({
  stack:    { 0: "SP",    offset: 256  },
  local:    { 0: "LCL",   offset: 300  },
  argument: { 0: "ARG",   offset: 400  },
  this:     { 0: "THIS",  offset: 3000 },
  that:     { 0: "THAT",  offset: 3010 },
  pointer:  { 0: "",      offset: 3    },
  temp:     { 0: "",      offset: 5    },
  static:   { 0: "",      offset: 16   },
})

const { push, pop, setD } = Object.freeze({
  push:[
    `@SP`,
    `A=M`,
    `M=D`,
    `@SP`,
    `M=M+1`
  ],
  pop:[
    `@SP`,
    `M=M-1`,
    `A=M`,
    `D=M`,
  ],
  setD:((d: string | number) => [
    `@${d}`,
    `D=A`
  ])
})

const init = {
  stackPointer:  [
    setD(SYMBOL.stack.offset),    `@${SYMBOL.stack[0]}`,`M=D`,
  ],
  localBase: [
    setD(SYMBOL.local.offset),    `@${SYMBOL.local[0]}`,`M=D`,
  ],
  argumentsBase: [
    setD(SYMBOL.argument.offset), `@${SYMBOL.argument[0]}`,`M=D`
  ],
  thisBase: [
    setD(SYMBOL.this.offset),     `@${SYMBOL.this[0]}`,`M=D`
  ],
  thatBase: [
    setD(SYMBOL.that.offset),     `@${SYMBOL.that[0]}`,`M=D`,
  ],
}

export default class CodeWriter {
  _stream?: WriteStream
  _fileName?: string

  constructor(stream: WriteStream) {
    this._stream = stream
  }

  stream() {
    if (!this._stream) throw new Error('Error: WriteStream was not passed')
    return this._stream
  }

  write(parsed: Array<CommandElement>): void{
    try {
      this.writeComment("initialize")
      this.writeCode([
        ...init.stackPointer,
        ...init.localBase,
        ...init.argumentsBase,
        ...init.thisBase,
        ...init.thatBase,
      ])

      for (const command of parsed) {
        this.writeComment(command)
        switch (command.type) {
          case "C_ARITHMETIC":
            this.writeArithmetic(command.arg1 ? command.arg1 : "")
          case "C_PUSH":
          case "C_POP":
            this.writePushPop(command)
        }
      }

      this.close()
    } catch (e) {
      throw new Error(e.message)
    }
  }

  setFileName(fileName: string) {
    this._fileName = fileName
  }

  writeArithmetic(command: string): void {
    let { com, jmp, single } = { com: "", jmp: "", single: false }

    switch(command) {
      case "eq" : com = `D=M-D`; jmp = `JEQ`; break
      case "gt" : com = `D=M-D`; jmp = "JGT"; break
      case "lt" : com = `D=M-D`; jmp = "JLT"; break
      case "add": com = `M=D+M`; break
      case "sub": com = `M=M-D`; break
      case "and": com = `M=D&M`; break
      case "or" : com = `M=D|M`; break
      case "neg": com = `D=-M` ; single = true; break
      case "not": com = `D=!M` ; single = true; break
      default: break
    }

    if (single) {
      this.writeCode([
        `@SP`,
        `A=M-1`,
        `${com}`,
        `M=D`,
      ])
    }
    if (!single) {
      this.writeCode([
        `@SP`,
        `M=M-1`,
        `A=M`,
        `D=M`,
        `@SP`,
        `M=M-1`,
        `A=M`,
        `${com}`,
      ])
    }
    if (!(single || jmp)) {
      this.writeCode([
        `@SP`,
        `M=M+1`
      ])
    }
    if (jmp) {
      const { jif, jel, jfi } = genVar(genSymbolId())

      this.writeCode([
        `@${jif}`,
        `D;${jmp}`,
        `@${jel}`,
        `D;JMP`,
        `(${jif})`,
        `D=-1`,
        `@${jfi}`,
        `D;JMP`,
        `(${jel})`,
        `D=0`,
        `(${jfi})`,
        `@SP`,
        `M=M-1`,
        `A=M-1`,
        `M=D`
      ])
    }
  }

  writePushPop(commands: CommandElement): void {
    const { arg1, arg2, command } = commands

    switch(command) {
      case "push":
        this.writePush(arg1, arg2)
        break

      case "pop":
        this.writePop(arg1, arg2)
        break
    }
  }

  writePop(segment:string,arg2:number): void {
    const { R_ADDRESS } = Object.freeze({ R_ADDRESS: "R13" })

    let asm:string[]|null= []

    if (segment === "constant") {
      this.writeCode([
        pop,
        `@${arg2}`,
        `D=A`
      ])
    }
    else if (["static" , "temp", "pointer"].includes(segment)) {
      this.writeCode([
        pop,
        `@${SYMBOL[segment].offset + arg2}`,
        `M=D`
      ])
    }
    else if (["local", "argument", "this", "that" ].includes(segment)) {
      this.writeCode([
        setD(arg2),
        `@${SYMBOL[segment][0]}`,
        `D=M+D`,
        `@${R_ADDRESS}`,
        `M=D`,
        `@SP`,
        `M=M-1`,
        `A=M`,
        `D=M`,
        `@${R_ADDRESS}`,
        `A=M`,
        `M=D`,
      ])
    }

    this.writeCode(asm)
  }

  writePush(segment:string,arg2:number): void {
    if (segment === "constant") {
      this.writeCode([
        setD(arg2),
        push,
      ])
    }
    else if (["static", "temp", "pointer"].includes(segment)) {
      this.writeCode([
        `@${SYMBOL[segment].offset + arg2}`,
        `D=M`,
        push,
      ])
    }
    else if (["local", "argument", "this", "that" ].includes(segment)) {
      this.writeCode([
        setD(arg2),
        `@${SYMBOL[segment][0]}`, // 400
        `A=M`,  // A = (400) M[2]
        `A=D+A`,// A = 2 + 400
        `D=M`,  // D = M[402]
        push,
      ])
    }
  }

  close(): void {
    this.writeCode([`0;JMP`])
    this.stream().end()
  }

  writeComment(commands: CommandElement | string): void {
    if (!commands) return
    else if (typeof commands === "string") {
      this.stream().write(`\n// ${commands}\n`)
    }
    else {
      const { command, arg1, arg2 } = commands

      if (command === arg1 || arg1 === '' || !arg1) {
        this.stream().write(`\n// ${command}\n`)
        return
      }
      if (arg1 && arg2) {
        this.stream().write(`\n// ${command} ${arg1} ${arg2}\n`)
        return
      }
      this.stream().write(`\n// ${command} ${arg1} ${arg2}\n`)
    }
  }

  writeCode(asm: Array<string[] | string >) {
    if (!asm) return
    this.stream().write(asm.flat().join('\n')+'\n')
  }
}