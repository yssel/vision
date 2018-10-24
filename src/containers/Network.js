import React, { Component} from 'react';
import { connect } from 'react-redux';

import '../styles/Network.css';

class Network extends Component{
	constructor(props){
		super(props);
	}

	render(){
		return(
			<div id='network-tab'>
				<div id='network-tools'>
					<div className='button-main loves bold ls-2 bg-1 bgh-2 c-white fs-12 mr-30'>
						<i className='fas fa-compass mr-10'></i>
						NAVIGATE
					</div>

					<div className='mr-15'>
						<span className='open-sans fs-13 mr-10'> Mode: </span>
						<div className='button-tight bg-white bgh-gray open-sans fs-12'>
							<span className='mr-10'>Horizontal</span>
							<i className='fas fa-caret-down fs-16'></i>
						</div>
					</div>

					<div>
						<span className='open-sans fs-13 mr-10'> Checkout: </span>
						<div className='button-tight bg-white bgh-gray open-sans fs-12'>
							<i className='fas fa-code-branch fs-12 mr-15'></i>
							<span className='mr-10'>Master</span>
						</div>
					</div>
				</div>
				<div id='network-graph'>
					Network GRAPHHHH
				</div>
			</div>
		)
	}
}

export default Network;