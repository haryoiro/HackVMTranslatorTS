import { isVM, expandAllFiles } from './utils';
import * as fs from "fs"
import Parser from './Parser'
import CodeWriter from './CodeWriter'


const { argv } = process

if (argv.length !== 3) {
  console.error('パスを一つ入力してください。')
  process.exit()
}

const targetPath = argv[2]

const currentStats = fs.statSync(targetPath)

let pathArr: string[] = []

if (currentStats.isDirectory()) {
  console.log(expandAllFiles(targetPath, pathArr))
} else if (currentStats.isFile() && isVM(targetPath)) {
  pathArr.push(targetPath)
}

// .vmファイルが見つからなければ終了
if (pathArr.length < 1) {
  console.error("Error: .vmファイルが見つかりませんでした。")
  process.exit()
}

pathArr.forEach((file) => {
  const reader = fs.readFileSync(file, 'utf-8')
  const writer = fs.createWriteStream(file.replace('.vm', '.asm'), 'utf-8')
  const parsed = new Parser(reader).parse()
  new CodeWriter(writer).write(parsed)
});


