import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TodoDescription } from './TodoDescription'

describe('TodoDescription', () => {
  it('shows a short description without an unnecessary toggle', () => {
    const markup = renderToStaticMarkup(
      <TodoDescription description="短い説明です。" />,
    )

    expect(markup).toContain('短い説明です。')
    expect(markup).not.toContain('is-collapsed')
    expect(markup).not.toContain('全文を表示')
  })

  it('collapses a long description behind an accessible toggle', () => {
    const markup = renderToStaticMarkup(
      <TodoDescription description={'長い説明'.repeat(21)} />,
    )

    expect(markup).toContain('todo-description is-collapsed')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('全文を表示')
  })

  it('collapses descriptions with more than three explicit lines', () => {
    const threeLines = renderToStaticMarkup(
      <TodoDescription description={'1行目\n2行目\n3行目'} />,
    )
    const fourLines = renderToStaticMarkup(
      <TodoDescription description={'1行目\n2行目\n3行目\n4行目'} />,
    )

    expect(threeLines).not.toContain('全文を表示')
    expect(fourLines).toContain('全文を表示')
  })
})
