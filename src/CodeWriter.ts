import { createWriteStream, WriteStream } from 'fs';
import { CommandElement } from './types';

const a = (value:string|number) => `@${value}`
// const l = (value:string|number) => `(${value})`

// /**
//  * @param symbol Aレジスタに入力するシンボル @Xxx
//  * @param cOrder C命令 dest=comp
//  */
// const ac = (symbol:string|number,cOrder:string) => `@${symbol}\n${cOrder}\n`
/**
 * generateVariable
 * @param jump comp;jump のjumpニーモニック
 * @param unique かぶらない変数を宣言するために一意の値を入力
 */
const genVar = (jump:string, unique:string|number) => {
  let jif = `${jump}${unique.toString()}`
  let jelse   = 'N' + jif
  let jend = jif + 'END'

  return {
    if: jif,
    else: jelse,
    end: jend,
  }
}

export default class CodeWriter {
  _stream: WriteStream
  _fileName?: string = "a"
  _command: CommandElement = { type:undefined, command:[""], arg1:"", arg2:0}
  sp: SP
  asm: string[] = []
  constructor(stream: WriteStream) {
    this._stream = stream ? stream : createWriteStream("a","utf-8")
    this.sp = new SP()
  }
  write(parsed: Array<CommandElement>): void{
    try {
      for (const command of parsed) {
        this._command = command
        switch (command.type) {
          case "C_ARITHMETIC":
            this.writeArithmetic(command.arg1 ? command.arg1 : "")
          case "C_PUSH":
            this.writePushPop(command.command[0])
          case "C_POP":
        }
      }
    } catch (e) {
      throw new Error(e.message)
    }
  }

  async setFileName(fileName: string) {
    this._fileName = fileName
  }
  writeArithmetic(command: string): void {
    let com = ""
    let jmp = ""
    let sg = false
    const address = () => this.sp.address()
    switch(command) {
      case "eq"   :
        com = `D=D-M`
        jmp = `JEQ`
        break
      case "gt"   :
        com = `D=M-D`
        jmp = "JGT"
        break
      case "lt"   :
        com = `D=M-D`
        jmp = "JLT"
        break
      case "add"  :
        com = `M=D+M`
        break
      case "sub"  :
        com = `M=M-D`
        break
      case "neg"  :
        sg = true
        com = `M=-M`
        break
      case "and"  :
        com = `M=D&M`
        break
      case "or"   :
        com = `M=D|M`
        break
      case "not"  :
        sg = true
        com = `M=!M`
        break
      default:
        break
    }
    this.sp.dec()
    if (sg) {
      this.asm.push('@'+(address()), com)
    }
    if (!sg) {
      this.asm.push('@'+(address()), `D=M`)
      this.sp.dec()
      this.asm.push('@'+(address()), com)

    }
    if (jmp) {
      const jump = genVar(jmp, this.sp.address())

      this.asm.push(
        '@'+jump.if,
        `D;${jmp}`,
        '@'+jump.else,
        `D;JMP`
      )

      this.asm.push(
        `(${jump.if})`,
        '@'+address(),
        `M=-1`,
        '@'+jump.end,
        `D;JMP`
      )

      this.asm.push(
        `(${jump.else})`,
        '@'+address(),
        `M=0`,
        '@'+jump.end,
        `D;JMP`
      )

      this.asm.push(`(${jump.end})`)
    }
    this.sp.inc()

    this._stream.write(this.asm.join('\n')+'\n')
    this.asm = []
  }
  writePushPop(command:string): void {
    const arg1 = this._command.arg1
    const arg2 = this._command.arg2
    switch(arg1) {
      case "constant":
        this.asm.push(
          a(arg2),
          `D=A`
        )
        break;
    }
    switch(command) {
      case "push":
        this.asm.push(
          a(this.sp.address()),
          `M=D\n`
        )
        this.sp.inc()
        break;
    }


    this._stream.write(this.asm.join('\n')+'\n')
    this.asm = []
  }
  close(): void {}
}




class SP {
  private _reg = {
    sp: 256,
  }
  constructor() {

  }
  address = (): number => this._reg.sp
  inc = (): number => {
    this._reg.sp += 1
    return this._reg.sp
  }
  dec = (): number => {
    this._reg.sp -= 1
    return this._reg.sp
  }
  static = (address:number|null): number => {
    if (!address) return 0
    return address + 16
  }
}