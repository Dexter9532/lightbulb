import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packageJsonPath = path.join(root, 'package.json')
const versionTsPath = path.join(root, 'src', 'version.ts')
const buildGradlePath = path.join(root, 'android', 'app', 'build.gradle')

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = pkg.version
const [major, minor, patch] = version.split('.').map(Number)
const versionCode = major * 10000 + minor * 100 + patch

fs.writeFileSync(versionTsPath, `export const APP_VERSION = '${version}'\n`)

const buildGradle = fs.readFileSync(buildGradlePath, 'utf8')
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)

fs.writeFileSync(buildGradlePath, buildGradle)

console.log(`Synced version ${version} -> versionCode ${versionCode}`)
