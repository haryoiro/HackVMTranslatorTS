import { createWriteStream, WriteStream } from 'fs';
import { CommandElement } from './types';

/**
 * generateVariable
 * @param jump comp;jump のjumpニーモニック
 * @param unique かぶらない変数を宣言するために一意の値を入力
 */
const genVar = (unique:string|number) => {
  return {
    if: `IF${unique}`,
    el: `EL${unique}`,
    fi: `FI${unique}`,
  }
}

export default class CodeWriter {
  _stream: WriteStream
  _fileName?: string = "a"
  _command: CommandElement = { type:undefined, command:[""], arg1:"", arg2:0}
  _uniqueLoopNum = 0
  asm: string[] = []
  constructor(stream: WriteStream) {
    this._stream = stream ? stream : createWriteStream("a","utf-8")
  }
  write(parsed: Array<CommandElement>): void{
    try {
      this.asm.push(`@256`,`D=A`,`@SP`,`M=D`)
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
    switch(command) {
      case "eq"   : com = `D=M-D`; jmp = `JEQ`; break
      case "gt"   : com = `D=M-D`; jmp = "JGT"; break
      case "lt"   : com = `D=M-D`; jmp = "JLT"; break
      case "add"  : com = `D=D+M`; break
      case "sub"  : com = `D=M-D`; break
      case "and"  : com = `D=D&M`; break
      case "or"   : com = `D=D|M`; break
      case "neg"  : com = `D=-M` ; sg = true; break
      case "not"  : com = `D=!M` ; sg = true; break
      default: break;
    }
    if (sg) {
      this.asm.push(
        `  // sum single ${command}`,
        `  @SP`,
        `  A=M-1`,
        `  ${com}`,
        `  M=D`
      )
    }
    if (!sg) {
      this.asm.push(
        `  @SP`,
        `  A=M-1`,
        `  D=M`,
        `  A=A-1`,
        `  ${com}`,
      )
    }
    if (!(sg || jmp)) {
      this.asm.push(
        `  M=D`,
        `  @SP`,
        `  M=M-1`,
      )
    }
    if (jmp) {
      const jump = genVar(this.uniqueNum())
      this.asm.push(
        `  // jump ${jump.if}`,
        `  @${jump.if}`,
        `  D;${jmp}`,
        `  @${jump.el}`,
        `  D;JMP`,
        `(${jump.if})`,
        `  D=-1`,
        `  @${jump.fi}`,
        `  D;JMP`,
        `(${jump.el})`,
        `  D=0`,
        `(${jump.fi})`,
        `  @SP`,
        `  M=M-1`,
        `  A=M-1`,
        `  M=D`,
      )
    }

    this._stream.write(this.asm.join('\n')+'\n')
    this.asm = []
  }
  writePushPop(command:string): void {
    const arg1 = this._command.arg1
    const arg2 = this._command.arg2
    switch(arg1) {
      case "constant":
        this.asm.push(
          `  // push constant ${arg2}`,
          `  @${arg2}`,
          `  D=A`,
        )
        break;
    }
    switch(command) {
      case "push":
        this.asm.push(
          `  @SP`,
          `  A=M`,
          `  M=D`,
          `  @SP`,
          `  M=M+1`,
          ``
        )
        break
    }


    this._stream.write(this.asm.join('\n')+'\n')
    this.asm = []
  }
  close(): void {}
  uniqueNum() {
    return this._uniqueLoopNum += 1
  }
}