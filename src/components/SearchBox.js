import React, { Component } from 'react'
import '../styles/SearchBox.css'

/*
  Usage: 
  <SearchBox 
    database= <array of { name, ..other props }> // name field important for filtering results
    onResultSelect= (result) => {} <function that receives result as param, triggered when a result is selected>
    
    optional props:
    id= <your-id-name>
    width = <width of search box>
    initValue= <initial value of input>
    resetOnFocus= <boolean, whether search input always empties on focus>
  />

*/

export default class SearchBox extends Component {
  constructor(props){
    super(props);
  }

  componentWillMount() {
    let init = this.props.initValue ? this.props.initValue : ''

    this.setState({ 
      isLoading: false, 
      results: [], 
      value: init,
      placeholder: true,
      lastValid: init
    })
  }

  getIcon = (type) => {
    switch (type) {
      case 'ALL':
        return <i className="fas fa-code"></i>
      case 'BRANCH':
        return <i className="fas fa-code-branch"></i>
      case 'TAG':
        return <i className="fas fa-tag"></i>
      case 'COMMIT':
        return <i className="far fa-dot-circle"></i>
    }
  }

  escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  showHideResults = (show) => {
    const search = document.getElementById(`${this.props.id}`)
    const results = search.getElementsByClassName('results')[0]
    results.style.display = show ? 'block' : 'none'
  }

  resetComponent = (empty=false) => {
    this.setState({ 
      results: [], 
      isLoading: false, 
      value: empty ? '' : this.state.lastValid,
      placeholder: true
    })
  }

  handleFocus = () =>{
    if(this.props.resetOnFocus) this.setState({ value: '' })
    this.showHideResults(true)
  }

  handleBlur = () =>{
    this.showHideResults(false)
    this.resetComponent()
  }

  handleChange = (e) =>{
    if(this.state.isLoading) clearTimeout(this.state.loadResults) 

    let value = e.target.value
    this.setState({
      placeholder: false,
      isLoading: true,
      value
    });

    this.setState({
      loadResults: setTimeout(() => {
      if(value.length < 1) {
        this.resetComponent(true)
        return
      }else{
        const re = new RegExp('.*'+ this.escapeRegExp(value) +'.*', 'i')
        let results = this.props.database.filter(({name}) => name.match(re))

        this.setState({
          isLoading: false,
          results
        })
      }
    }, 500)})
  }

  handleResultSelect = (result) => {
    this.setState({ 
      lastValid: result.name
    })
    this.props.onResultSelect(result)
  }

  render() {
    const { isLoading, value, results, placeholder } = this.state;
    const { width, id } = this.props;

    return (
      <div id={id} style={{ width, position: 'relative' }}>
        <div className='input'>
          <input 
            value = {this.state.value}
            type='text'
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            onChange={this.handleChange}
          />
        </div>
        <div className='results' style={{display: 'none', position: 'absolute'}}>
          {isLoading &&
            <div className='loading' style={{ padding: 30, textAlign: 'center' }}>
              <i className="fas fa-circle-notch fa-spin"></i>
            </div>
          }

          {!isLoading && placeholder && 
            <div className='placeholder' style={{ paddingTop: 10}}>
              <SearchResult
                key={0}
                value={{ id: 0, type: 'ALL', name: 'All' }}
                onResultSelect={this.handleResultSelect} 
              />

              <SearchResult
                key={1}
                value={{ id: 1, type: 'BRANCH', name: this.props.master_name }}
                onResultSelect={this.handleResultSelect} 
              />
              <div style={{ background: '#f5f5f5', marginTop: 10, padding: 15, fontSize: 11 }}>
                <div>or search the name of</div>
                <div className='badge' style={{marginRight: 5}}><i className="fas fa-code-branch"></i>branch</div>
                <div className='badge'><i className="fas fa-tag"></i>tag</div>
              </div>
            </div>
          }

          {!isLoading && !placeholder && results.length < 1 &&
            <div className='empty' style={{ padding: 30, textAlign: 'center', color: 'lightGray' }}>
              No matches
            </div>
          }

          { !isLoading && !placeholder && results.length > 0 && 
            <div className='results-wrapper'>
              {results.map((result, i) =>{
                return (
                  <SearchResult
                    key={i}
                    value={result}
                    onResultSelect={this.handleResultSelect} 
                  />
                )
              })}
            </div>
          }
        </div>
      </div>
    )
  }
}

class SearchResult extends Component {
  constructor(props){
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(){
    this.props.onResultSelect(this.props.value);
  }

  getIcon = (type) => {
    switch (type) {
      case 'ALL':
        return <i className="fas fa-code"></i>
      case 'BRANCH':
        return <i className="fas fa-code-branch"></i>
      case 'TAG':
        return <i className="fas fa-tag"></i>
      case 'COMMIT':
        return <i className="far fa-dot-circle"></i>
    }
  }

  render(){
    const { value } = this.props
    return(
      <div className='result' onMouseDown={this.handleClick}>
        {this.getIcon(value.type)}
        {value.name}
      </div>
    )
  }
}