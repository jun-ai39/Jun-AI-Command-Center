import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NaviAssistant } from './NaviAssistant'

describe('NaviAssistant', () => {
  it('starts as a quiet minimized avatar', () => {
    const markup = renderToStaticMarkup(<NaviAssistant />)

    expect(markup).toContain('aria-label="ナビ常駐アシスタント"')
    expect(markup).toContain('aria-label="ナビを開く"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('ナビの案内')
  })

  it('can render its phase one information panel', () => {
    const markup = renderToStaticMarkup(<NaviAssistant initialExpanded />)

    expect(markup).toContain('aria-label="ナビの案内"')
    expect(markup).toContain('PHOENIX ASSIST')
    expect(markup).toContain('今は静かにそばにいるよ')
    expect(markup).toContain('常駐アバター準備完了・AI未接続')
    expect(markup).toContain('aria-expanded="true"')
  })
})
