import { isVM, expandAllFiles } from './src/utils';
import * as path from "path"
import * as fs from "fs"
import Parser from './src/Parser'
import CodeWriter from './src/CodeWriter'

async function main() {
  try {
    const { argv } = process


    if (argv.length !== 3) {
      await console.error('パスを一つ入力してください。')
      process.exit()
    }

    const targetPath = argv[2]
    let childPathList: string[] = []
    const currentStats = await fs.statSync(
      await path.resolve(__dirname, targetPath)
    )

    // 渡されたパスがディレクトリだった場合再帰的にファイルを検索
    if (currentStats.isDirectory()) {
      childPathList = await expandAllFiles(targetPath, childPathList)
    }
    // 渡されたパスがファイルだった場合、パスをそのまま使う。
    else if (currentStats.isFile() && isVM(targetPath)) {
      childPathList = [targetPath]
    }

    // .vmファイルが見つからなければ終了
    if (childPathList.length < 1) {
      console.error("Error: .vmファイルが見つかりませんでした。")
      process.exit()
    }

    // ディレクトリ内のファイル一覧から重複したパスを削除
    const uniqchildPathList = [...new Set(childPathList)]

    // ストリームに渡すためのパス文字列
    const writableFileName = (() => {
      if (currentStats.isDirectory()) {
        const currentDirectoryName = targetPath.split('/').splice(-1)[0]
        return `${targetPath}/${currentDirectoryName}.asm`
      }
      return targetPath.replace('.vm', '.asm')
    })()


    console.log('Start the translation from VM Language to Hack Assembly...\n\n')

    // ストリームを開く
    const writer = await fs.createWriteStream(writableFileName, 'utf-8')
    console.log(writableFileName, '\n\t---> Open WriteStream\n\n')

    // パース済みのコードを一時的に保存しておくための配列
    let parsedCodeTmp:any[] = []
    await uniqchildPathList.forEach(async (file) => {

      const reader = await fs.readFileSync(file, 'utf-8')

      console.log('Parse is started')
      const parsed = new Parser(reader)
        .setFileName(file)
        .parse()

      console.log('Target\t--->', file, '\nto\t--->', writableFileName, '\n')

      parsedCodeTmp = [...parsedCodeTmp, ...parsed]
    });

    // Translate VM to Asm
    //
    const functionName = writableFileName.split('/').splice(-1)[0]
    await new CodeWriter(writer)
      .setFileName(functionName)
      .write(parsedCodeTmp)

    // Emd of stream
    await writer.end()
    console.log('File was Translated')
  } catch (e) {
    console.error(e)
  }
}
main()
