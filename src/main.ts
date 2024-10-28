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

/** A mapping of filename prefixes to the directory they should be moved to. */
const dirPrefixes: Record<string, string> = {
  lg: 'Language Guide',
  api: 'API Reference'
}

const transformLinks = () => {
  return (tree: Node) => {
    visit(tree, 'link', (node: Link) => {
      const { url } = node
      if (url.trim() && !url.startsWith('https://') && !url.startsWith('#')) {
        const originalUrl = url
        node.url = `../${url.replace('.md', '')}`

        Object.keys(dirPrefixes).forEach(prefix => {
          if (path.basename(node.url).startsWith(prefix)) {
            node.url = node.url.replace(
              prefix,
              '../' +
                dirPrefixes[prefix].toLowerCase().replaceAll(' ', '-') +
                '/' +
                prefix
            )
          }
        })

        console.log(`Transformed link (${originalUrl}) to (${node.url})`)
      }

      // TODO: slug transformation
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
    const htmlPath = path.join(outPath, 'html')

    const globber = await glob.create(path.join(docsPath, '**.html'))

    const files = []

    core.startGroup('Copying HTML files')
    for await (const file of globber.globGenerator()) {
      console.log(`Copying ${path.relative(docsPath, file)}`)
      const dest = path.join(htmlPath, path.relative(docsPath, file))

      mkdirSync(path.dirname(dest), { recursive: true })

      copyFileSync(file, dest)
      files.push(dest)
    }
    core.endGroup()

    core.startGroup('Transforming content')
    console.log('TODO: Transform content')
    core.endGroup()

    core.startGroup('Generating MDX files')
    console.log('TODO: Generate MDX files')
    core.endGroup()
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
