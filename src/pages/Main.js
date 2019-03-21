import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Switch, Route, NavLink } from 'react-router-dom';

import { fetchRepo } from '../actions/repoActions';
import { fetchBranches } from '../actions/branchesActions'
import { fetchTags } from '../actions/tagsActions'

import Network from '../containers/Network';
import Stats from '../containers/Stats';

import SearchBox from '../components/SearchBox';

import '../styles/Main.css';

class Main extends Component {
	constructor(props){
		super(props);
		const { params } = this.props.match;
		const { username, reponame } = params;
		this.state = {
			checkout: 'ALL',
            checkout_from: 'All',
		}

		this.fetchRepoData = this.fetchRepoData.bind(this)
		this.fetchRepoData(username, reponame, props);
	}

	setSearchDatabase = () => {
		let database = [{id: 0, type: 'ALL', name: 'All'}, {id: 1, type: 'BRANCH', name: this.props.master_name}]
		database = database.concat(Object.keys(this.props.branches).map((branch, i) => { 
			return {id: i+2, type: 'BRANCH', name: branch} 
		}))
		const length = database.length
		database = database.concat(Object.keys(this.props.tags).map((tag, i) => { return {id: length+2+i, type: 'TAG', name: tag} }))
		
		this.setState({
			database
		})
	}

	async fetchRepoData(username, reponame, props) {
		await props.fetchRepo(username, reponame);
		await props.fetchBranches(username, reponame);
		await props.fetchTags(username, reponame);
		this.setSearchDatabase()
	}

	checkout = (result) => {
		console.log('result', result)
		this.setState({
			network_id: result.id,
			checkout: result.type,
			checkout_from: result.name
		})
	}

	render(){
		return(
			<div>
				<div id='sidenav' style={{display: 'inline-block'}}>
					<div id='burger'>
						<i className="fas fa-bars"></i>
					</div>

					<div id='nav'>
					<div className='nav-tab'>
					<NavLink to={`/${this.props.username}/${this.props.reponame}`} exact> 
						<div><i className='fas fa-code-branch' style={{ transform: 'rotate(-90deg)' }}></i></div>
						{/*<div>Network</div>*/}
					</NavLink>
					</div>
					<div className='nav-tab'>
					<NavLink to={`/${this.props.username}/${this.props.reponame}/stats`} exact> 
						<div><i className='fas fa-chart-line'></i></div>
						{/*<div>Stats</div>*/}
					</NavLink>
					</div>
					<div className='nav-tab'>
					<NavLink to={`/${this.props.username}/${this.props.reponame}/board`} exact> 
						<div><i className='fas fa-columns'></i></div>
						{/*<div>Board</div>*/}
					</NavLink>
					</div>
					<div className='nav-tab'>
					<NavLink to={`/${this.props.username}/${this.props.reponame}/activity`} exact> 
						<div><i className='fas fa-bullseye'></i></div>
						{/*<div>Activity</div>*/}
					</NavLink>
					</div>
					</div>
					<div id='logout' >
						<div>
							<div>
								<NavLink to={`/`} exact> 
									<div><i className='fas fa-sign-out-alt'></i></div>
									{/*<div>Logout</div>*/}
								</NavLink>
							</div>
						</div>
					</div>
				</div>
				<div id='page'>
					<div id='bar'>
						<div id='repo-user'>
							<span id='username' className='c-4 fs-12'>
								<i className='fab fa-github mr-5 c-dg'></i>
								{`${this.props.username}/`}
							</span>
							<span id='reponame' className='c-white bold fs-14'>{this.props.reponame}</span>
						</div>
						<div id='search'>
						<div style={{paddingRight: 8, fontSize: 12, color: 'white'}}>Graph : </div>
						<SearchBox 
							id='search-box'
							database={this.state.database}
							onResultSelect={this.checkout}
							resetOnFocus={true}
							initValue={this.state.checkout_from}
							master_name={this.props.master_name}
						/>
						</div>
					</div>
					<div id='main'>
						{
						this.props.username && this.props.branches && this.props.tags &&
						<Switch>
							<Route 
								exact 
								path='/:username/:reponame'
								render={(props) => <Network {...props} key={this.state.network_id} checkout={this.state.checkout} checkout_from={this.state.checkout_from} />}
							/>
							<Route path='/:username/:reponame/stats' component={Stats}/>
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
		tags: state.tags.data.tags,
		master_name: state.repo.data.master_name,
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