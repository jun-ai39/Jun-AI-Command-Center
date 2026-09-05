import { useId, useState } from 'react'

const TODO_DESCRIPTION_PREVIEW_MAX_LENGTH = 80
const TODO_DESCRIPTION_PREVIEW_MAX_LINES = 3

function shouldCollapseTodoDescription(description: string): boolean {
  return (
    description.length > TODO_DESCRIPTION_PREVIEW_MAX_LENGTH ||
    description.split(/\r\n|\r|\n/).length > TODO_DESCRIPTION_PREVIEW_MAX_LINES
  )
}

type TodoDescriptionProps = {
  readonly description: string
}

export function TodoDescription({ description }: TodoDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const descriptionId = useId()
  const canCollapse = shouldCollapseTodoDescription(description)

  return (
    <div className="todo-description-block">
      <p
        id={descriptionId}
        className={`todo-description${canCollapse && !isExpanded ? ' is-collapsed' : ''}`}
      >
        {description}
      </p>
      {canCollapse && (
        <button
          type="button"
          className="todo-description-toggle"
          aria-controls={descriptionId}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          {isExpanded ? '折りたたむ' : '全文を表示'}
        </button>
      )}
    </div>
  )
}
