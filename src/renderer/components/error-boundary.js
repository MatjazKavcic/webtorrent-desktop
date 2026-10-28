const React = require('react')
const PropTypes = require('prop-types')
const FlatButton = require('material-ui/FlatButton').default
const RaisedButton = require('material-ui/RaisedButton').default

const { dispatch, dispatcher } = require('../lib/dispatcher')

// Catches render errors in a subtree so one broken view can't unmount the whole app.
// Without this, React tears down the root on any render error and leaves a blank window.
class ErrorBoundary extends React.Component {
  static get propTypes () {
    return {
      // Changing this (e.g. navigating to another view) clears the error
      resetKey: PropTypes.string
    }
  }

  constructor (props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError (error) {
    return { error }
  }

  componentDidCatch (error) {
    // Logs it and shows it in the error popover
    dispatch('error', error)
  }

  componentDidUpdate (prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render () {
    const { error } = this.state
    if (!error) return this.props.children

    const style = { padding: 30 }
    return (
      <div className='error-boundary' style={style}>
        <p><strong>Something went wrong displaying this screen.</strong></p>
        <p>{error.message || String(error)}</p>
        <div style={{ marginTop: 20 }}>
          <FlatButton
            className='control'
            style={{ marginRight: 10 }}
            label='TRY AGAIN'
            onClick={() => this.setState({ error: null })}
          />
          <RaisedButton
            className='control'
            primary
            label='BACK TO LIST'
            onClick={dispatcher('backToList')}
          />
        </div>
      </div>
    )
  }
}

module.exports = ErrorBoundary
