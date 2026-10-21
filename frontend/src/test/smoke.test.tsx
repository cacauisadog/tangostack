import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

test('renders in happy-dom', () => {
  render(<h1>hello</h1>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

test('user-event clicks', async () => {
  const user = userEvent.setup()
  render(<button onClick={(e) => (e.currentTarget.textContent = 'clicked')}>go</button>)
  await user.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('clicked')
})
