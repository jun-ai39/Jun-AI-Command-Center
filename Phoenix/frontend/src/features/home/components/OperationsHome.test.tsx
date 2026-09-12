import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { OperationsHome } from './OperationsHome'

describe('OperationsHome', () => {
  it('provides one direct entrance for every normal-user core function', () => {
    const markup = renderToStaticMarkup(<OperationsHome onOpen={vi.fn()} />)

    expect(markup).toContain('PHOENIX OS / HOME')
    expect(markup).toContain('設備保全ホーム')
    expect(markup).toContain('aria-label="設備保全の中核機能"')
    expect(markup).toContain('data-screen="today-maintenance"')
    expect(markup).toContain('data-screen="inspection"')
    expect(markup).toContain('data-screen="attention"')
    expect(markup).toContain('data-screen="work-report"')
    expect(markup).toContain('data-screen="equipment"')
    expect(markup).toContain('data-screen="history"')
    expect(markup.match(/<button/g)).toHaveLength(6)
    expect(markup).not.toContain('href="#today-maintenance-title"')
    expect(markup.match(/operations-home-card /g)).toHaveLength(6)
  })
})
