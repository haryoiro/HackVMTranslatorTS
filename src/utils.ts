import * as fs from 'fs'
import * as path from 'path'


export const isVM = (name:string): boolean => name.endsWith('vm')

export const expandAllFiles = (
  dir: string,
  pathArr: string[]
): string[] => {
  // ディレクトリ内のすべての項目を取得
  const allFiles = fs.readdirSync(dir)
  allFiles.forEach((filename) => {
      const fullPath = path.join(dir, filename)

      const stats = fs.statSync(fullPath)

      // .vmファイルのみ抽出
      if (stats.isFile() && isVM(fullPath)) {
        pathArr.push(fullPath)
      }

      // ディレクトリがなくなるまで再帰的に実行
      else if (stats.isDirectory()) {
        pathArr.push(...expandAllFiles(fullPath, pathArr))
      }
    })
  return pathArr
}
