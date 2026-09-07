import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
          <span style={{ fontSize: '20px', color: '#555' }}>something went wrong</span>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            style={{ fontSize: '16px', cursor: 'pointer', padding: '6px 16px', borderRadius: '8px', border: '1px solid #ccc', background: 'transparent' }}
          >
            go home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
