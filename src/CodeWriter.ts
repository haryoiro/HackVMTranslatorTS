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
const genReturnLabel = (() => {
  let labels:{[key: string]:number} = {};
  return (functionName: string) => {
    labels[functionName] = (labels[functionName]||0) + 1;
    return `${functionName}$ret.${labels[functionName]}`
  }
})();


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
  pop: ({setD = true} = {}) => [
    '@SP',
    'M=M-1',
    'A=M',
    ...(setD ? ['D=M'] : []),
  ],

  setD:((d: string | number): string[] => [
    `@${d}`,
    `D=A`
  ]),
})

export default class CodeWriter {
  _stream?: WriteStream
  _fileName?: string
  functionName:string=""

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
      this.writeInit()

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

  close(): void {
    // infinite loop
    this.writeCode([
      `(END)`,
      `@END`,
      `0;JMP`
    ])
    this.stream().end()
    console.log('Stream was closed...')
  }

  setFileName(fileName: string) {
    this._fileName = fileName
    this.functionName = fileName.slice(0, -4)
    return this
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
        pop(),
        pop({setD:false}),
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
        pop(),
        setD(arg2),
      ])
    }
    // ex:
    //  pop segment index
    //  > RAM[SYMBOL + index] = RAM[SP]
    else if (["static" , "temp", "pointer"].includes(segment)) {
      this.writeCode([
        pop(),
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
        `@${SYMBOL[segment][0]}`,
        `A=M`,
        `A=D+A`,
        `D=M`,
        push,
      ])
    }
  }

  // BootStrap Code
  // Initialize StackPointer
  //   and Call Sys.init
  writeInit(): void {
    this.writeComment("BootStrap")
    this.writeCode([
      setD(SYMBOL.stack.offset),
      `@${SYMBOL.stack[0]}`,
      `M=D`,
    ])
    this.writeCall("Sys.init", 0)
  }

  // label xxx
  writeLabel(label: string) :void {
    this.writeCode([
      `(${this.functionName}$${label})`
    ])
  }

  // goto xxx
  writeGoto(label:string):void{
    this.writeCode([
      `@${this.functionName}$${label}`,
      `0;JMP`,
    ])
  }

  // if-goto xxx
  writeIf(label:string):void{
    this.writeCode([
      `@SP`,
      `M=M-1`,
      `A=M`,
      `D=M`,
      `@${this.functionName}$${label}`,
      `D;JNE`
    ])
  }

  writeCall(functionName: string,numArgs: number): void {
    const RETURN_LABEL = genReturnLabel(functionName)

    this.writeCode([
      `@${RETURN_LABEL}`,
      `D=A`,
      push,
      `@LCL`,
      `D=M`,
      push,
      `@ARG`,
      `D=M`,
      push,
      `@THIS`,
      `D=M`,
      push,
      `@THAT`,
      `D=M`,
      push,
      `@SP`,
      `D=M`,
      `@${numArgs + 5}`,
      `D=A`,
      `@SP`,
      `D=M-D`,
      `@ARG`,
      `M=D`,
      `@SP`,
      `D=M`,
      `@LCL`,
      `M=D`,
      `@${functionName}`,
      `D;JMP`,
      `(${RETURN_LABEL})`
    ])
  }

  /**
   * function f n

   * (f)
   *    repeat n times:
   *    push 0

   */
  writeFunction(functionName: string, numLocals: number): void {
    this.writeCode([`(${functionName})`])

    if (numLocals > 0) {
      for(let i = 0;i < numLocals;i++) {
        this.writeCode([
            setD(0),
            push,
        ])
      }
    }
  }

  writeReturn(): void {
    const { FRAME, RET } = Object.freeze({
      FRAME : "R13",
      RET   : "R14",
    })

    let { setVarFromFrame } = {
      setVarFromFrame: (target:string, offset:number) => [
        `@${FRAME}`,
        'D=M',
        `@${offset}`,
        'A=D-A',
        'D=M',
        `@${target}`,
        'M=D',
      ],
    }


    this.writeCode([
      '@LCL',
      'D=M',
      `@${FRAME}`,
      'M=D',
      setVarFromFrame(RET, 5),
      pop(),
      '@ARG',
      'A=M',
      'M=D',
      '@ARG',
      'D=M+1',
      '@SP',
      'M=D',
      setVarFromFrame('THAT', 1),
      setVarFromFrame('THIS', 2),
      setVarFromFrame('ARG', 3),
      setVarFromFrame('LCL', 4),
      `@${RET}`,
      'A=M',
      '0;JMP',
    ])
  }
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
    if (command === arg1 || !arg1) {
      this.writeCode([`// ${command}`])
      return
    }
    else if (arg1 && arg2) {
      this.writeCode([`// ${command} ${arg1} ${arg2}`])
      return
    }
    else if (arg1) {
      this.writeCode([`// ${command} ${arg1}`])
    }

    return
  }
}
