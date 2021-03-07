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
      .replace(/\r\n?/g,"\n")
      .split('\n')
      .map(a => {
        const commentRemoved = a.includes('//')? a.slice(0, a.indexOf('//')): a
        const splited = commentRemoved.split(' ')
        return splited
      })
      .filter(a => !!a[0])

    for (const command of current) {
      this.currentCommand = command

      if (this.hasMoreCommand()) {
        this.advance()
        const newCommand: CommandElement = {
          type: this.currentType,
          command:command[0],
          arg1:this.arg1(),
          arg2:this.arg2(),
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
    return !isNaN(result) ? result : 0
  }
}