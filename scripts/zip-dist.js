import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// 读取 package.json 获取项目名
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
const projectName = pkg.name || 'dist'

// 生成时间戳 格式: YYYYMMDDHHMMSS
const now = new Date()
const timestamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
  String(now.getSeconds()).padStart(2, '0')
].join('')

const zipName = `${projectName}-${timestamp}.zip`

console.log(`\n📦 正在压缩 dist 目录...`)

// 使用 zip 命令压缩 dist 目录
execSync(`cd "${rootDir}" && zip -r "${zipName}" dist`, { stdio: 'inherit' })

console.log(`✅ 压缩完成: ${zipName}\n`)