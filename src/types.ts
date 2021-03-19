export type CommandType =
  "C_ARITHMETIC" |
  "C_PUSH" |
  "C_POP" |
  "C_LABEL" |
  "C_GOTO" |
  "C_IF" |
  "C_FUNCTION" |
  "C_RETURN" |
  "C_CALL" |
  undefined

export type CommandElement = {
  type:CommandType,
  command: string,
  arg1: string,
  arg2: number,
  functionName?: string
}


export type CommandPushPop =
  "push" |
  "pop"

//算術コマンド
export type CommandArithmetic =
  "add" | // 加算
  "sub" | // 減算
  "neg" | // 符号反転
  "eq"  | // equality
  "gt"  | // greater than
  "lt"  | // less than
  "and" | // x && y
  "or"  | // x || y
  "not"   // !y

// // メモリアクセスコマンドの第２引数
export type CommantSegments =
  "pointer"   | //
  "local"     | // RAM[1] // LCL
  "argument"  | // RAM[2] // ARG
  "this"      | // RAM[3]
  "that"      | // RAM[4]
  "temp"      | // RAM[5-12]
  "static"    | // RAM[16-255]
  "constant"    // RAM[i]

// // push static 3
// // > @Xxx.3
// // > D=M

// // プログラムフローコマンド
export type CommandProgFlow =
  "label"   |
  "goto"    |
  "if-goto"

// // 関数呼び出しコマンド
export type CommandFunctionCall =
  "function"  |
  "call"      |
  "return"
