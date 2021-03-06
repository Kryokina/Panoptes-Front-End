React = require 'react'
createReactClass = require 'create-react-class'
List = require './list'

CollectionsList = createReactClass
  displayName: 'CollectionsPage'

  componentDidMount: ->
    if @props.project? or @props.params?.profile_name?
      document.documentElement.classList.add 'on-secondary-page'

  componentWillUnmount: ->
    if @props.project? or @props.params?.profile_name?
      document.documentElement.classList.remove 'on-secondary-page'

  render: ->
    props = List.getPropsForList(@props,false)
    <List {...props} baseType="collections" />

module.exports = CollectionsList
