import type { IThemedToken } from 'shiki'
import { measureMonospaceTypeface } from './measureMonospaceTypeface'

interface SVGRendererOptions {
  /**
   * A monospace font.
   */
  fontFamily: string
  /**
   * Default to 16px.
   */
  fontSize?: number
  /**
   * How high should a line be, in relation to `fontSize`. Default to 1.4.
   * Extra spaces are distributed evenly on top/bottom of each line.
   */
  lineHeightToFontSizeRatio?: number
  /**
   * Background color. Default to `#fff`.
   */
  bg?: string
  /**
   * Background corner radius. Default to `4px`.
   */
  bgCornerRadius?: number
  /**
   * How much padding should be left to the left/right in relation to font width. Default to 4.
   */
  bgSideCharPadding?: number
  /**
   * How much padding should be left to the top/bottom in relation to
   * line height (`fontSize * lineHeightToFontSizeRatio`). Default to 2.
   */
  bgVerticalCharPadding?: number
}

export async function getSVGRenderer(options: SVGRendererOptions) {
  const fontFamily = options.fontFamily
  const fontSize = options.fontSize || 16
  const lineHeightToFontSizeRatio = options.lineHeightToFontSizeRatio || 1.4
  const bg = options.bg || '#fff'
  const bgCornerRadius = options.bgCornerRadius || 4
  const bgSideCharPadding = options.bgSideCharPadding || 4
  const bgVerticalCharPadding = options.bgVerticalCharPadding || 2

  const measurement = await measureMonospaceTypeface(fontFamily, fontSize)

  const lineheight = measurement.height * lineHeightToFontSizeRatio

  return {
    renderToSVG(lines: IThemedToken[][]) {
      let longestLineTextLength = 0
      lines.forEach(lTokens => {
        let lineTextLength = 0
        lTokens.forEach(l => (lineTextLength += l.content.length))

        if (lineTextLength > longestLineTextLength) {
          longestLineTextLength = lineTextLength
        }
      })

      /**
       * longest line + left/right 4 char width
       */
      const bgWidth = (longestLineTextLength + bgSideCharPadding * 2) * measurement.width
      /**
       * all rows + 2 rows top/bot
       */
      const bgHeight = (lines.length + bgVerticalCharPadding * 2) * lineheight

      let svg = ''

      svg += `<svg viewBox="0 0 ${bgWidth} ${bgHeight}" width="${bgWidth}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">\n`

      svg += `<rect id="bg" fill="${bg}" width="${bgWidth}" height="${bgHeight}" rx="${bgCornerRadius}"></rect>`

      svg += `<g id="tokens" transform="translate(${measurement.width * bgSideCharPadding}, ${
        lineheight * bgVerticalCharPadding
      })">`

      lines.forEach((l: IThemedToken[], index: number) => {
        if (l.length === 0) {
          svg += `\n`
        } else {
          svg += `<text font-family="${fontFamily}" font-size="${fontSize}" y="${
            lineheight * (index + 1)
          }">\n`

          let indent = 0

          l.forEach(token => {
            const tokenAttributes = tokenColorToSVGAttributes(token.color)
            /**
             * SVG rendering in Sketch/Affinity Photos: `<tspan>` with leading whitespace will render without whitespace
             * Need to manually offset `x`
             */
            if (token.content.startsWith(' ') && token.content.search(/\S/) !== -1) {
              const firstNonWhitespaceIndex = token.content.search(/\S/)

              // Whitespace + content, such as ` foo`
              // Render as `<tspan> </tspan><tspan>foo</tspan>`, where the second `tspan` is offset by whitespace * width
              svg += `<tspan x="${indent * measurement.width}" ${tokenAttributes}>${escapeHtml(
                token.content.slice(0, firstNonWhitespaceIndex)
              )}</tspan>`

              svg += `<tspan x="${
                (indent + firstNonWhitespaceIndex) * measurement.width
              }" ${tokenAttributes}>${escapeHtml(
                token.content.slice(firstNonWhitespaceIndex)
              )}</tspan>`
            } else {
              svg += `<tspan x="${indent * measurement.width}" ${tokenAttributes}>${escapeHtml(
                token.content
              )}</tspan>`
            }

            indent += token.content.length
          })
          svg += `\n</text>\n`
        }
      })
      svg = svg.replace(/\n*$/, '') // Get rid of final new lines

      svg += '</g>'
      svg += '\n</svg>\n'

      return svg
    }
  }
}

const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

function escapeHtml(html: string) {
  return html.replace(/[&<>"']/g, chr => htmlEscapes[chr])
}

function tokenColorToSVGAttributes(color: string) {
  if (color.slice(1).length <= 6) {
    return `fill="${color}"`
  } else if (color.slice(1).length === 8) {
    const opacity = parseInt(color.slice(1 + 6), 16) / 255
    const roughRoundedOpacity = Math.floor(opacity * 100) / 100
    return `fill="${color.slice(0, 1 + 6)}" opacity="${roughRoundedOpacity}"`
  }

  return `fill="#fff"`
}
