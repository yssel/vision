import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Switch, Route, NavLink } from 'react-router-dom';

import { fetchRepo } from '../actions/repoActions';
import { fetchBranches } from '../actions/branchesActions'
import { fetchTags } from '../actions/tagsActions'

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
		await props.fetchRepo(username, reponame);
		await props.fetchBranches(username, reponame);
		await props.fetchTags(username, reponame);
	}

	render(){
		return(
			<div>
				<div id='nav-wrapper'>
					<div id='nav'>
						<div className='nav-tab'>
						<NavLink to={`/${this.props.username}/${this.props.reponame}`} exact> 
							<div><i className='fas fa-code-branch' style={{ transform: 'rotate(-90deg)' }}></i></div>
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
					<div id='repo-user'>
						<div className='open-sans'>
							<div id='username' className='c-4'>{`${this.props.username}/`}</div>
							<div id='reponame' className='c-white bold'>{this.props.reponame}</div>
						</div>
					</div>
					<div id='logout' >
						<div>
							<div>
								<NavLink to={`/`} exact> 
									<div><i className='fas fa-sign-out-alt'></i></div>
									<div>Logout</div>
								</NavLink>
							</div>
						</div>
					</div>
				</div>
				<div id='page'>
					<div id='main'>
						{
						this.props.username && 
						<Switch>
							<Route path='/:username/:reponame' exact component={Network}></Route>
							<Route path='/:username/:reponame/stats' component={Stats}></Route>
						</Switch>
						}
					</div>
				</div>
			</div>
		)
	}
}

function mapStateToProps(state) {
	return {
		username: state.repo.data.owner,
		reponame: state.repo.data.name,
		branches: state.branches.data.branches,
		tags: state.tags.data.tags
	}
}

function mapDispatchToProps(dispatch) {
	return {
		fetchBranches: async (owner, name) => await dispatch(fetchBranches(owner, name)),
		fetchTags: async (owner, name) => await dispatch(fetchTags(owner, name)),
		fetchRepo: async (owner, name) => await dispatch(fetchRepo(owner, name)),
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(Main)