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
    setD(SYMBOL.stack.offset),
    `@${SYMBOL.stack[0]}`,
    `M=D`,
  ],
  localBase: [
    setD(SYMBOL.local.offset),
    `@${SYMBOL.local[0]}`,
    `M=D`,
  ],
  argumentsBase: [
    setD(SYMBOL.argument.offset),
    `@${SYMBOL.argument[0]}`,
    `M=D`,
  ],
  thisBase: [
    setD(SYMBOL.this.offset),
    `@${SYMBOL.this[0]}`,
    `M=D`,
  ],
  thatBase: [
    setD(SYMBOL.that.offset),
    `@${SYMBOL.that[0]}`,
    `M=D`,
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

  writeCode(asm: Array<string[] | string >) {
    if (!asm) return
    this.stream().write(asm.flat().join('\n')+'\n')
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
            this.writeArithmetic(command.arg1 ? command.arg1 : "") ;break
          case "C_PUSH"   :
          case "C_POP"    : this.writePushPop(command);break
          case "C_LABEL"  : this.writeLabel(command.arg1);break
          case "C_GOTO"   : this.writeGoto(command.arg1);break
          case "C_IF"     : this.writeIf(command.arg1);break
          case "C_CALL"   : this.writeCall(command.arg1, command.arg2);break
          case "C_FUNCTION":this.writeFunction(command.arg1, command.arg2);break
          case "C_RETURN" : this.writeReturn();break
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
      const { jif, jel, jfi } = genVar( genSymbolId() )

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

    // command segment index
    //   *       *       *-* arg2
    //   |       *---------* arg1
    //   *-----------------* command

    const { arg1, arg2, command } = commands

    switch(command) {
      case "push": this.writePush(arg1, arg2)
        break
      case "pop" : this.writePop(arg1, arg2)
        break
    }
  }

  writePop(segment:string,arg2:number): void {
    const { R_ADDRESS } = Object.freeze({ R_ADDRESS: "R13" })

    // ex:
    //  pop constant index
    //  > RAM[index] = RAM[SP]
    if (segment === "constant") {
      this.writeCode([
        pop,
        setD(arg2),
      ])
    }
    // ex:
    //  pop segment index
    //  > RAM[SYMBOL + index] = RAM[SP]
    else if (["static" , "temp", "pointer"].includes(segment)) {
      this.writeCode([
        pop,
        `@${SYMBOL[segment].offset + arg2}`,
        `M=D`
      ])
    }
    // ex:
    //  pop segment index
    //  > R13    = RAM[SYMBOL] + index
    //  > RAM[R13] = RAM[SP]
    // // R13 === RAM[13]
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

  }

  writePush(segment:string,arg2:number): void {
    // ex:
    //  push constant 10
    //  > RAM[SP] = 10
    if (segment === "constant") {
      this.writeCode([
        setD(arg2),
        push,
      ])
    }
    // ex:
    //  push segment index
    //  > RAM[SP] = RAM[ RAM[SYMBOL] + index ]
    else if (["static", "temp", "pointer"].includes(segment)) {
      this.writeCode([
        `@${SYMBOL[segment].offset + arg2}`,
        `D=M`,
        push,
      ])
    }
    // ex:
    //  push segment index
    //  > RAM[SP] = RAM[ RAM[SYMBOL] + index ]
    else if (["local", "argument", "this", "that" ].includes(segment)) {
      this.writeCode([
        setD(arg2),
        `@${SYMBOL[segment][0]}`,
        `A=M`,
        `A=D+A`,
        `D=M`,
        push,
      ])
    }
  }

  writeInit():void {}
  writeLabel(label: string) :void {
    this.writeCode([`(${label})`])
  }
  writeGoto(label:string):void{
    this.writeCode([
      `@${label}`,
      `D;JMP`,
    ])
  }
  writeIf(label:string):void{
    this.writeCode([
      pop,
      `@${label}`,
      `D;JNE`,
    ])
  }
  writeCall(functionName:string,numArgs:number):void{}
  // 1
  writeFunction(functionName:string,numLocals:number):void{}
  // 2
  writeReturn():void {}

  writeComment(commands: CommandElement | string): void {
    if (!commands) return

    // commandが文字列なら直接コメントを出力
    else if (typeof commands === "string") {
      this.writeCode([`// ${commands}`])
      return
    }

    // commandを要素ごとに分解
    const { command, arg1, arg2 } = commands


    // arg1が空白、または算術
    if (command === arg1 || arg1 === '' || !arg1) {
      this.writeCode([`// ${command}`])
      return
    }

    else if (arg1 && arg2) {
      this.writeCode([`// ${command} ${arg1} ${arg2}`])
      return
    }

    return
  }

  close(): void {
    // infinite loop
    this.writeCode([
      `(END)`,
      `@END`,
      `0;JMP`
    ])
    this.stream().end()
  }
}
