import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Switch, Route, NavLink } from 'react-router-dom';

import { fetchRepo } from '../actions/repoActions';

import Network from '../containers/Network';
import Stats from '../containers/Stats';

import '../styles/Main.css';

class Main extends Component {
	constructor(props){
		super(props);
		const { params } = this.props.match;
		const { username, reponame } = params;
		this.fetchRepoData = this.fetchRepoData.bind(this)
		this.fetchRepoData(username, reponame, props);
	}

	async fetchRepoData(username, reponame, props) {
		await props.fetchRepo(username, reponame)
	}

	render(){
		return(
			<div>
				<div id='nav-wrapper'>
					<div id='nav'>
						<div 
							className='baron nav-tab'
							style={{
								color: '#cca2e1',
								fontSize: '16px'}}>
							VISION
						</div>
						<div className='nav-tab'>
						<NavLink to={`/${this.props.username}/${this.props.reponame}`} exact> 
							<div><i className='fas fa-code-branch'></i></div>
							<div>Network</div>
						</NavLink>
						</div>
						<div className='nav-tab'>
						<NavLink to={`/${this.props.username}/${this.props.reponame}/stats`} exact> 
							<div><i className='fas fa-chart-line'></i></div>
							<div>Stats</div>
						</NavLink>
						</div>
						<div className='nav-tab'>
						<NavLink to={`/${this.props.username}/${this.props.reponame}/board`} exact> 
							<div><i className='fas fa-columns'></i></div>
							<div>Board</div>
						</NavLink>
						</div>
						<div className='nav-tab'>
						<NavLink to={`/${this.props.username}/${this.props.reponame}/activity`} exact> 
							<div><i className='fas fa-bullseye'></i></div>
							<div>Activity</div>
						</NavLink>
						</div>
					</div>
				</div>
				<div id='page'>
					<div id='main'>
						<Switch>
							<Route path='/:username/:reponame' exact component={Network}></Route>
							<Route path='/:username/:reponame/stats' component={Stats}></Route>
						</Switch>
					</div>
				</div>
			</div>
		)
	}
}

function mapStateToProps(state) {
	return {
		username: state.repo.data.owner,
		reponame: state.repo.data.name
	}
}

function mapDispatchToProps(dispatch) {
	return {
		fetchRepo: async (owner, name) => await dispatch(fetchRepo(owner, name)),
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(Main)