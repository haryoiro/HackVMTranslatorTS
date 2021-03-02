import { CommandType, CommandElement } from './types';

export default class Parser {
  commands: Array<CommandElement> = []
  currentCommand: string[] = []
  currentType?: CommandType
  _file?: string | Buffer

  constructor(file: string | Buffer) {
    this._file = file
  }
  parse() {
    if (!this._file) throw new Error('')
    const current = this._file
      .toString()
      .split('\r\n')
      .map(a => {
        const commentRemoved = a.includes('//') ? a.slice(0, a.indexOf('//')) : a
        const splited = commentRemoved.split(' ')
        return splited
      })
      .filter(a => !!a[0])

    for (const command of current) {
      this.currentCommand = command

      if (this.hasMoreCommand()) {
        this.advance()
        const arg1 = (this.currentType !== "C_RETURN") ? this.arg1() : ""
        const arg2 = (this.currentType === ("C_PUSH" || "C_POP" || "C_FUNCTION" || "C_CALL")) ? this.arg2() : 0

        const newCommand: CommandElement = {
          type: this.currentType,
          command,
          arg1,
          arg2,
        }

        this.commands.push(newCommand)
      }
    }

    return this.commands
  }

  hasMoreCommand(): boolean {
    return !!(this.currentCommand[0] && this.currentCommand[0] !== '')
  }
  advance() {
    this.currentType = this.commandType()
  }
  commandType(): CommandType {
    const command: string = this.currentCommand[0]
    switch (command) {
      case "push"   :
        return "C_PUSH"
      case "pop"    :
        return "C_POP"
      case "label"  :
        return "C_LABEL"
      case "goto"   :
        return "C_GOTO"
      case "if-goto":
        return "C_IF"
      case "function":
        return "C_FUNCTION"
      case "return" :
        return "C_RETURN"
      case "call"   :
        return "C_CALL"
      case "add"    :
      case "sub"    :
      case "neg"    :
      case "eq"     :
      case "gt"     :
      case "lt"     :
      case "and"    :
      case "or"     :
      case "not"    :
        return "C_ARITHMETIC"
      default:
        return
    }

  }
  arg1() {
    if (this.currentType === "C_ARITHMETIC") {
      return this.currentCommand[0]
    }
    return this.currentCommand[1]
  }
  arg2(): number {
    const result = parseInt(this.currentCommand[2])
    if (isNaN(result)) {
      throw new Error("arg2 is NaN")
    }
    return result
  }
}