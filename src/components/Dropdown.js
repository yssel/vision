import React, { Component} from 'react';

// Grabbed pen from: https://codepen.io/taylorharwood/pen/EggrOO

class Dropdown extends Component {
  constructor(props) {
    super(props);
   
    this.state = {
      open: false,
      selected: this.props.initial || -1
    };
  }
  
  toggleDropdown() {
    this.setState({
      active: !this.state.active
    });
  }
  
  handleClick(i) {
    this.setState({
      selected: i
    });
  }
  
  renderOptions() {
    if (!this.props.options) {
      return;
    }
    
    return this.props.options.map((option, i) => {      
      return (
        <li 
          onClick={evt => this.handleClick(i)} 
          key={i} 
          className={"dropdown__list-item " + (i === this.state.selected ? 'dropdown__list-item--active' : '')}
        >
          {option}
        </li>
      );  
    });  
  }
  
  render() {
    return (
      <div className="dropdown">
        <div
          onClick={() => this.toggleDropdown()}
          className="dropdown__toggle dropdown__list-item"
        >
          {this.props.title}
          <i class="fa fa-angle-down" aria-hidden="true"></i>
        </div>
        
        <ul className={"dropdown__list " + (this.state.active ? 'dropdown__list--active' : '')}>{this.renderOptions()}</ul>      
      </div>
    );
  }
}

// Dropdown.propTypes = {
//   title: React.PropTypes.string,
//   options: React.PropTypes.array 
// };

export default Dropdown;

// usage:
// const options = ['Apple', 'Orange', 'Pear', 'Mango'];
// ReactDOM.render(<Dropdown title="Dropdown Menu" options={options} />, document.getElementById('mount'));