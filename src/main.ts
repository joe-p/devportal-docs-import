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
import { visit } from 'unist-util-visit'
import { Node } from 'unist'
import { Link } from 'mdast'
import * as cheerio from 'cheerio'

/** A mapping of filename prefixes to the directory they should be moved to. */
const dirPrefixes: Record<string, string> = {
  lg: 'Language Guide',
  api: 'API Reference'
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const docsPath = core.getInput('docsPath', { required: true })
    const outPath = core.getInput('outPath', { required: true })

    const globber = await glob.create(path.join(docsPath, '**.html'))

    const files = []

    core.startGroup('Copying HTML files')
    for await (const file of globber.globGenerator()) {
      console.log(`Copying ${path.relative(docsPath, file)}`)
      const dest = path
        .join(outPath, path.relative(docsPath, file))
        .replace('.html', '.mdx')

      mkdirSync(path.dirname(dest), { recursive: true })

      copyFileSync(file, dest)
      files.push(dest)
    }
    core.endGroup()

    core.startGroup('Transforming content')
    for (const file of files) {
      const html = readFileSync(file, 'utf-8')
      const $ = cheerio.load(html)

      // Extract content from the nested div structure
      let content =
        $(
          '.page .main .content .article-container #furo-main-content'
        ).html() || ''

      // Append '../' to all relative links using cheerio
      $('a').each((_, el) => {
        const href = $(el).attr('href')
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          console.log(`Fixing link ${href}`)
          $(el).attr('href', `../${href}`)
        }
      })

      // Update content with the modified HTML
      content =
        $(
          '.page .main .content .article-container #furo-main-content'
        ).html() || content

      const title = (
        $('h1 span').first().text() || $('h1').first().text()
      )?.replace('¶', '')

      content = `---
title: "${title}"
---
<div set:html={\`${content}\`} />
`

      // Write only the extracted content back to the file
      writeFileSync(file, content)
      console.log(`Transformed ${file}`)
    }
    core.endGroup()

    core.startGroup('Generating MDX files')

    core.endGroup()
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
