React = require 'react'
createReactClass = require 'create-react-class'
mockData = require './mock-data'
{ ClassifierWrapper } = require '../../classifier'
`import tasks from '../../classifier/tasks';`

ClassificationViewer = createReactClass
  getDefaultProps: ->
    classification: null

  getInitialState: ->
    showOnlyLast: false
    showThrowaways: false

  componentDidMount: ->
    @_boundForceUpdate = @forceUpdate.bind this
    mockData.classification.listen @_boundForceUpdate

  componentWillUnmount: ->
    mockData.classification.stopListening @_boundForceUpdate
    @_boundForceUpdate = null

  ignoreUnderscoredProperties: (key, value) ->
    unless "#{key}".charAt(0) is '_'
      value

  togglePersistAnnotations: (e) ->
    @props.classification._workflow.configuration.persist_annotations = e.target.checked
    @forceUpdate()

  render: ->
    showing =  if @state.showOnlyLast
      @props.classification.annotations[@props.classification.annotations.length - 1]
    else
      @props.classification.annotations

    replacer = if @state.showThrowaways
      null
    else
      @ignoreUnderscoredProperties

    <div>
      <label>
        <input type="checkbox" checked={@state.showOnlyLast} onChange={(e) => @setState showOnlyLast: e.target.checked} />{' '}
        Show only the last annotation
      </label>
      &ensp;
      <label>
        <input type="checkbox" checked={@state.showThrowaways} onChange={(e) => @setState showThrowaways: e.target.checked} />{' '}
        Show throwaway properties
      </label>
      &ensp;
      <label>
        <input type="checkbox" checked={@props.classification._workflow.configuration.persist_annotations} onChange={@togglePersistAnnotations} />{' '}
        Persist Annotations
      </label>
      <br />
      <pre>{JSON.stringify showing, replacer, 2}</pre>
    </div>

DevClassifierPage = createReactClass
  getDefaultProps: ->
    classification: mockData.classification
    project: mockData.project
    preferences: mockData.preferences

  componentDidMount: ->
    document.body.style.backgroundColor = '#444'
    document.body.style.color = 'white'

  componentWillUnmount: ->
    document.body.style.backgroundColor = ''
    document.body.style.color = ''

  reload: ->
    workflow = @props.classification._workflow
    firstTask = workflow.tasks[workflow.first_task]
    FirstTaskComponent = tasks[firstTask.type]
    firstAnnotation = Object.assign {task: workflow.first_task}, FirstTaskComponent.getDefaultAnnotation()
    @props.classification.update
      completed: false
      annotations: [firstAnnotation]

  render: ->
    <div className="content-container">
      <ClassifierWrapper user={@props.user}  project={@props.project} workflow={@props.classification._workflow} preferences={@props.preferences} classification={@props.classification} onClickNext={@reload} />
      <hr />
      <ClassificationViewer classification={@props.classification} />
    </div>

module.exports = DevClassifierPage
