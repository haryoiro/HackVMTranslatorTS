import * as fs from 'fs'
import * as path from 'path'


export const isVM = (name:string): boolean => name.endsWith('vm')

export const expandAllFiles = (
  dir: string,
  pathArr: string[]
): string[] => {

  // ディレクトリ内のすべての項目を取得
  fs.readdirSync(dir).forEach((filename) => {
      const fullPath = path.join(dir, filename)
      const stats = fs.statSync(fullPath)

      // .vmファイルのみ抽出
      if (stats.isFile() && isVM(fullPath)) {
        // 拡張子.vmのみ返す。
        pathArr.push(fullPath)
      }
      // ディレクトリがなくなるまで再帰的に実行
      else if (stats.isDirectory()) {
        pathArr.push(...expandAllFiles(fullPath, pathArr))
      }

    })

  return pathArr
}
