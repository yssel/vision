import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Switch, Route, NavLink, Redirect } from 'react-router-dom';

import { setCanvasDisplay } from '../actions/uiActions';
import { fetchRepo } from '../actions/repoActions';
import { fetchBranches } from '../actions/branchesActions'
import { fetchTags } from '../actions/tagsActions'

import Network from '../containers/Network';
import Stats from '../containers/Stats';
import Team from '../containers/Team';

import SearchBox from '../components/SearchBox';
import * as d3 from 'd3';
import '../styles/Main.css';

class Main extends Component {
	constructor(props){
		super(props);
		this.state = {
			checkout: 'ALL',
            checkout_from: 'All branches',
            toAuth: false,
            toLogin: false
		}

		let token = localStorage.getItem('vt')
		let repo = localStorage.getItem('repo')

		if(!token){
			this.state.toAuth = true
		}else if(!repo){
			this.state.toLogin = true
		}else if(!props.repoFetched){
			// fetch repo
			repo = JSON.parse(repo)
			this.state.token = token
			this.state.user = repo.user
			this.state.repo = repo.repo
			this.fetchRepoData();
		}
	}

	componentDidMount(){
		this.drawLegends()	
	}

	drawLegends = () => {
		let NODE_RADIUS = 4;

		let regular = d3.select('#regular-commits')
		regular.append('line')
			.attr('class','legend-line')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', NODE_RADIUS+NODE_RADIUS+15)
			.attr('y2', NODE_RADIUS+10)
		regular.append('circle')
			.attr('class', 'commit-node')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS)
            .attr('stroke', 'black')
            .attr('fill', 'white')

        let merge = d3.select('#merge-commits')
		merge.append('line')
			.attr('class','legend-line')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', NODE_RADIUS+NODE_RADIUS+15)
			.attr('y2', NODE_RADIUS+10)
		merge.append('circle')
			.attr('class', 'commit-node')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*0.5)
            .attr('stroke', 'black')
            .attr('fill', 'black')

        let progressRegular = d3.select('#progress-regular')
		progressRegular.append('circle')
            .attr('class', 'commit-halo has-done')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*2.5)
            .attr('fill', 'black')
            .attr('stroke', 'black')

		progressRegular.append('line')
			.attr('class','legend-line')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', NODE_RADIUS+NODE_RADIUS+15)
			.attr('y2', NODE_RADIUS+10)
		progressRegular.append('circle')
			.attr('class', 'commit-node')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS)
            .attr('stroke', 'black')
            .attr('fill', 'white')

        let progressMerge = d3.select('#progress-merge')
		progressMerge.append('circle')
            .attr('class', 'commit-halo has-done')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*2.5)
            .attr('fill', 'black')
            .attr('stroke', 'black')
		progressMerge.append('line')
			.attr('class','legend-line')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', NODE_RADIUS+NODE_RADIUS+15)
			.attr('y2', NODE_RADIUS+10)
		progressMerge.append('circle')
			.attr('class', 'commit-node')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*0.5)
            .attr('stroke', 'black')
            .attr('fill', 'black')

        let doneRegular = d3.select('#done-regular')
		doneRegular.append('circle')
            .attr('class', 'commit-halo')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*2.5)
            .attr('fill', 'black')
            .attr('stroke', 'black')

		doneRegular.append('line')
			.attr('class','legend-line')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', NODE_RADIUS+NODE_RADIUS+15)
			.attr('y2', NODE_RADIUS+10)
		doneRegular.append('circle')
			.attr('class', 'commit-node')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS)
            .attr('stroke', 'black')
            .attr('fill', 'white')

        let doneMerge = d3.select('#done-merge')
		doneMerge.append('circle')
            .attr('class', 'commit-halo')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*2.5)
            .attr('fill', 'black')
            .attr('stroke', 'black')
		doneMerge.append('line')
			.attr('class','legend-line')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', NODE_RADIUS+NODE_RADIUS+15)
			.attr('y2', NODE_RADIUS+10)
		doneMerge.append('circle')
			.attr('class', 'commit-node')
            .attr('cx', NODE_RADIUS+10)
            .attr('cy', NODE_RADIUS+10)
            .attr('r', NODE_RADIUS*0.5)
            .attr('stroke', 'black')
            .attr('fill', 'black')

        d3.select('#parent-child')
        	.append('line')
        	.attr('class','legend-line')
            .style('stroke-linecap', 'round')
            .style('fill', 'transparent')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', 30)
			.attr('y2', NODE_RADIUS+10)

		d3.select('#pull-req')
        	.append('line')
        	.attr('class','legend-line pull')
            .style('stroke-linecap', 'round')
            .style('fill', 'transparent')
			.attr('x1', 5)
			.attr('y1', NODE_RADIUS+10)
			.attr('x2', 30)
			.attr('y2', NODE_RADIUS+10)

		d3.select('#branch-ptr')
			.append('rect')
            .attr('fill', 'black')
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('x', 0)
            .attr('y', 10)
            .attr('width', 30)
            .attr('height', 13)
        d3.select('#branch-ptr')
            .append('path')
            .style('fill', 'black')
            .attr('d', (d) => `M${35} ${16} L${28} ${12} L${28} ${21} Z`)

        d3.select('#tag-ptr')
            .append('path')
            .attr('fill', 'black')
            .style('stroke-width', '1px')
            .attr('d', (d) => `M${35} ${16} L${28} ${12} L${28} ${21} Z`)
        d3.select('#tag-ptr')
			.append('rect')
            .attr('fill', 'white')
            .attr('stroke', 'black')
            .style('stroke-width', '1px')
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('x', 0)
            .attr('y', 10)
            .attr('width', 30)
            .attr('height', 13)
	}


	fetchRepoData = async () => {
		const { user, repo } = this.state
		this.props.setCanvasDisplay('token', this.state.token);
		await this.props.fetchRepo(user, repo);
		await this.props.fetchBranches(user, repo);
		await this.props.fetchTags(user, repo);
		if(this.props.repoFetched){
			this.setSearchDatabase()
		}else{
			this.setState({ toAuth: true })
		}
	}

	setSearchDatabase = () => {
		let database = [{id: 0, type: 'ALL', name: 'All branches'}]
		database = database.concat(Object.keys(this.props.branches).map((branch, i) => { 
			if(branch === this.props.master_name) return {id: 1, type: 'BRANCH', name: this.props.master_name}
			else return {id: i+2, type: 'BRANCH', name: branch} 
		}))
		const length = database.length
		database = database.concat(Object.keys(this.props.tags).map((tag, i) => { return {id: length+2+i, type: 'TAG', name: tag} }))
		
		this.setState({
			database
		})
	}

	checkout = (result) => {
		this.setState({
			network_id: result.id,
			checkout: result.type,
			checkout_from: result.name
		})
	}

	toLogin = () => {
		localStorage.removeItem('repo')
		this.setState({
			toAuth: false,
			toMain: false,
			toLogin: true
		})
	}

	checkSession = () => {
		if(!localStorage.getItem('repo')){
			if(!localStorage.getItem('vt')){
				this.setState({
					toAuth: true,
					toMain: false,
					toLogin: false
				})
			}else{
				this.setState({
					toAuth: false,
					toMain: false,
					toLogin: true
				})
			}
		}
	}

	render(){
		if(this.state.toAuth || this.state.toLogin){
			return <Redirect to={{ pathname: '/', state: { toAuth: this.state.toAuth, toLogin: this.state.toLogin } }}/>
		}

		return(
			<div>
				<div id='sidenav' style={{display: 'inline-block'}}>
					<NavLink onClick={this.toLogin} to={{ pathname: '/', state: { toAuth: false, toLogin: true, toMain: false } }} exact> 
					<div id='burger'>
						<div><i className='fas fa-home'></i></div>
					</div>
					</NavLink>

					<div id='nav'>
					<div className='nav-tab'>
					<NavLink onClick={this.checkSession} to='/network' exact> 
						<div><i className='fas fa-code-branch' style={{ transform: 'rotate(-90deg)' }}></i></div>
					</NavLink>
					</div>
					<div className='nav-tab'>
					<NavLink onClick={this.checkSession} to='/stats' exact> 
						<div><i className='fas fa-chart-line'></i></div>
					</NavLink>
					</div>
					<div className='nav-tab'>
					<NavLink onClick={this.checkSession} to='/team' exact> 
						<div><i className='fas fa-users'></i></div>
					</NavLink>
					</div>
					
					</div>
					<div id='logout' >
						<div>
							<div>
								<NavLink to={{ pathname: '/', state: { toAuth: true, toLogin: false, toMain: false } }} exact> 
									<div><i className='fas fa-sign-out-alt'></i></div>
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
						<Switch>
							<Route exact path='/network'>
								<div id='search'>
								<div style={{fontFamily: 'Roboto Slab', paddingRight: 8, fontSize: 11, letterSpacing: 0.3, color: 'var(--color-4)'}}>Graph</div>
								<SearchBox 
									id='search-box'
									database={this.state.database}
									onResultSelect={this.checkout}
									resetOnFocus={true}
									initValue={this.state.checkout_from}
									master_name={this.props.master_name}
								/>
								</div>
							</Route>
						</Switch>
						<Switch>
							<Route exact path='/network'>
								<div id='legends'>
									<div id='view-legends'>
										<div>View Legends</div>
										<div className='legends'>
											<div className='h'>
												<div>Commits</div>
											</div>
											<div className='sh'>
												<div>TYPES</div>
												<div>In-progress</div>
												<div>Done</div>
											</div>
											<div className='b'>
												<div>
													<div className='drawings two'>
														<svg id='regular-commits'></svg>
														<svg id='merge-commits'></svg>
													</div>
													<div className='detail two'>
														<div>Regular</div>
														<div>Merge</div>
													</div>
												</div>
												<div>
													<div className='drawings two'>
														<svg id='progress-regular'></svg>
														<svg id='progress-merge'></svg>
													</div>
													<div className='detail'>
														<div>References an issue</div>
													</div>
												</div>
												<div>
													<div className='drawings two'>
														<svg id='done-regular'></svg>
														<svg id='done-merge'></svg>
													</div>
													<div className='detail'>
														<div>Closes/ fixes/ resolves an issue</div>
													</div>
												</div>
											</div>
											<div className='h'>
												<div>Connections</div>
												<div>Pull Request</div>
												<div>Pointers</div>
											</div>
											<div className='b'>
												<div>
													<div className='drawings'>
														<svg id='parent-child'></svg>
													</div>
													<div className='detail'>
														<div>parent-child</div>
													</div>
												</div>
												<div>
													<div className='drawings'>
														<svg id='pull-req'></svg>
													</div>
													<div className='detail'>
														<div>base-head</div>
													</div>
												</div>
												<div>
													<div className='drawings two'>
														<svg id='branch-ptr'></svg>
														<svg id='tag-ptr'></svg>
													</div>
													<div className='detail two'>
														<div>Branch</div>
														<div>Tag</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</Route>
						</Switch>
					</div>
					<div id='main'>
						{
						this.props.username && this.props.branches && this.props.tags &&
						<Switch>
							<Route 
								exact 
								path='/network'
								render={(props) => <Network {...props} key={this.state.network_id} checkout={this.state.checkout} checkout_from={this.state.checkout_from} />}
							/>
							<Route path='/stats' component={Stats}/>
							<Route path='/team' component={Team}/>
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
		token: state.ui.canvas.token,
		hasRepo: state.ui.canvas.hasRepo,
		repoFetched: state.repo.fetched,
		username: state.repo.data.owner,
		reponame: state.repo.data.name,
		branches: state.branches.data.branches,
		tags: state.tags.data.tags,
		master_name: state.repo.data.master_name,
	}
}

function mapDispatchToProps(dispatch) {
	return {
		setCanvasDisplay: (field, value) => dispatch(setCanvasDisplay(field, value)),
		fetchBranches: async (owner, name) => await dispatch(fetchBranches(owner, name)),
		fetchTags: async (owner, name) => await dispatch(fetchTags(owner, name)),
		fetchRepo: async (owner, name) => await dispatch(fetchRepo(owner, name)),
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(Main)