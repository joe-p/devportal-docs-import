import * as core from '@actions/core'
import * as glob from '@actions/glob'
import path from 'path'
import {
  copyFileSync,
  mkdirSync,
  renameSync,
  writeFileSync,
  readFileSync
} from 'fs'
import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import { Node } from 'unist'
import { Link } from 'mdast'

const transformLinks = () => {
  return (tree: Node) => {
    visit(tree, 'link', (node: Link) => {
      const { url } = node
      if (url.trim() && !url.startsWith('https://') && !url.startsWith('#')) {
        const originalUrl = url
        node.url = `../${url.replace('.md', '')}`

        console.log(`Transformed link (${originalUrl}) to (${node.url})`)
      }
    })
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const docsPath = core.getInput('docsPath', { required: true })
    const outPath = core.getInput('outPath', { required: true })

    const globber = await glob.create(path.join(docsPath, '**.md'))

    const files = []

    core.startGroup('Copying markdown files')
    for await (const file of globber.globGenerator()) {
      console.log(`Copying ${path.relative(docsPath, file)}`)
      const dest = path.join(outPath, path.relative(docsPath, file))
      copyFileSync(file, dest)
      files.push(dest)
    }
    core.endGroup()

    core.startGroup('Transforming content')
    const transformations = files.map(async file => {
      const result = await remark()
        .use(transformLinks)
        .process(readFileSync(file, 'utf8'))

      let newContent = String(result)

      // Use the first h1 as the title
      let title = newContent.match(/^# (.*)$/m)?.[1]

      // Some titles are links in backticks, ie `[title](link)`
      title = title?.split('`')[1] ?? title

      console.log(`Setting ${path.relative(outPath, file)} title to "${title}"`)

      // Write content with frontmatter and first h1 removed (astro does it for us based on frontmatter)
      newContent = `---\ntitle: "${title}"\n---\n\n${newContent.replace(/^# .*\n/, '')}`

      writeFileSync(file, newContent)
    })
    await Promise.all(transformations)
    core.endGroup()

    const dirs: Record<string, string> = {
      lg: 'Language Guide',
      api: 'API Reference'
    }

    const dirIndexFiles: Record<string, string> = {
      'language-guide.md': 'Language Guide',
      'api.md': 'API Reference'
    }

    Object.values(dirs).forEach(dir => {
      console.log(`Creating "${dir}" directory`)
      mkdirSync(path.join(outPath, dir), { recursive: true })
    })

    core.startGroup('Moving files into subdirectories')
    files.forEach(file => {
      const fileName = path.basename(file)

      if (dirIndexFiles[fileName]) {
        const dest = path.join(outPath, dirIndexFiles[fileName], 'index.md')
        renameSync(file, dest)
        console.log(
          `Moved ${fileName} to ${path.join(dirIndexFiles[fileName], 'index.md')}`
        )
        return
      }

      const dirPrefix = fileName.split('-')[0]
      if (dirPrefix.endsWith('.md')) return
      const dirName = dirs[dirPrefix]
      // Put in dir if dirName is defined, otherwise put in root
      const dest = path.join(outPath, dirName ?? '', fileName)
      renameSync(file, dest)
      console.log(`Moved ${fileName} to ${path.join(dirName ?? '', fileName)}`)
    })
    core.endGroup()
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
