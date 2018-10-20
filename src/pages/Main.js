import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Switch, Route, NavLink } from 'react-router-dom';

import { fetchRepo } from '../actions/repoActions';

import Network from '../containers/Network';
import Stats from '../containers/Stats';

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
			<div id='main'>
				<div id='nav'>
					<NavLink to={`/${this.props.username}/${this.props.reponame}`} exact> 
						Network
					</NavLink>
					<NavLink to={`/${this.props.username}/${this.props.reponame}/stats`} exact> 
						Stats
					</NavLink>
					<NavLink to={`/${this.props.username}/${this.props.reponame}/board`} exact> 
						Board
					</NavLink>
					<NavLink to={`/${this.props.username}/${this.props.reponame}/activity`} exact> 
						Activity
					</NavLink>
				</div>
				<div id='page'>
					<Switch>
						<Route path='/:username/:reponame' exact component={Network}></Route>
						<Route path='/:username/:reponame/stats' component={Stats}></Route>
					</Switch>
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