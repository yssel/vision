import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Redirect, Link } from 'react-router-dom';

import { setCanvasDisplay } from '../actions/uiActions';
import { fetchRepo } from '../actions/repoActions';
import { fetchBranches } from '../actions/branchesActions'
import { fetchTags } from '../actions/tagsActions'
import '../styles/Login.css'
class Login extends Component {
	constructor(props) {
		super(props);
		
		let state = props.location.state
		let repo = localStorage.getItem('repo')
		this.state = {
			toAuth: state ? !!state.toAuth : false,
			toLogin: state ? !!state.toLogin : false,
			toMain: repo ? true : false,
			spellCheck: false
		}

		if(!this.state.toMain && !this.state.toAuth) {
			if(this.state.toAuth){
				localStorage.clear()
			}else{
				localStorage.removeItem('repo')
				let token = localStorage.getItem('vt')
				if(token){
					// Authenticated
					this.props.setCanvasDisplay('token', token);
					this.state.toLogin = true
					// set user
					let user = JSON.parse(localStorage.getItem('user'))
					this.state.logged =  user // viewing purposes of the logged in
				}else{
					localStorage.clear()
					this.state.toLogin = false
					this.state.toAuth = true
				}

			}
		}
		else if(this.state.toAuth){
			this.state.toMain = false
			localStorage.clear()
		}
	}

	checkSession = () => {
        if(!localStorage.getItem('repo')){
            if(!localStorage.getItem('vt') && !this.state.toAuth){
            	localStorage.clear()
                this.setState({
                    toAuth: true,
                    toMain: false,
                    toLogin: false
                })
            }
        }else if(!this.state.toMain){
            this.setState({
                toAuth: false,
                toMain: true,
                toLogin: false
            })
        }
    }

	logout = () => {
		localStorage.clear()
		this.setState({
			logged: null,
			toAuth: true,
			toLogin: false,
			toMain: false
		})
	}

	handleChange = (event) => {
		this.checkSession()
		this.setState({[event.target.name]: event.target.value});
	}

	handleSubmit = async (event) =>{
		this.fetchRepoData();
		event.preventDefault();
	}

	fetchRepoData = async () => {
		if(!!localStorage.getItem('vt')){
			const { user, repo } = this.state
			await this.props.fetchRepo(user, repo);
			await this.props.fetchBranches(user, repo);
			await this.props.fetchTags(user, repo);
			if(this.props.repoFetched){
				let enteredRepo = { user, repo }
				localStorage.setItem('repo', JSON.stringify(enteredRepo))
				this.setState({ toMain: true })
			}
		}else{
			localStorage.clear()
			this.setState({ toAuth: true, toMain: false, toLogin: false })			
		}
	}

	render(){
		if (this.state.toMain) {
	      return <Redirect to='/network' />
	    }
		return(
			<div id='login-page'>
				<div id='hero'>
					<div className="hero-gradient">
						<div id="wave">
							<svg viewBox="0 0 1170 193">
								<path d="M1175 131.2c0 0-81-89.4-224.3-103.4S713 72 665 97c-86 46-148 63-271 7C221.7 25.5 56 104.5-4 197.4 -4 58.7-3.3 0.3-3.3 0.3L1175 0V131.2z"></path>
							</svg>
						</div>	
					</div>
				</div>
					<div className='title'>VISION</div>
					<div className='detail'>Visualize GitHub Repos <br/>and monitor modules at the same time.</div>
					{this.state.logged && 
					<Link id='logged-link' onClick={this.logout} to={{ pathname: '/', state: { toAuth: true, toLogin: false }}} > 
					<div id='logged'>
						<div id='logged-avatar'><img src={this.state.logged.avatar_url} alt=''/></div>
						<div id='logged-info'>
							<div className='logged-details'>
							<div>Viewing as:</div>
							<div className='login'>@{this.state.logged.login}</div>
							</div>
						</div>
						<div className='log-out'>
								<i className='fas fa-sign-out-alt'></i>
						</div>
					</div>
					</Link>}
					{ !!this.state.toLogin ? 
						<div id='login-form'>
							<form onSubmit={this.handleSubmit}>
								<div>
						        <input spellCheck={this.state.spellCheck} type="text" name='user' placeholder='Username (of repo owner)' value={this.state.user} onChange={this.handleChange} />
						        </div>
						        <div>
						        <input spellCheck={this.state.spellCheck} type="text" name='repo' placeholder='Repository name' value={this.state.repo} onChange={this.handleChange} />
						        </div>
						        <input className='submit' type="submit" value="Start" />
								<div id='error' style={{ visibility: this.props.repoErrors ? 'visible' : 'hidden' }}>
									<div>Unable to fetch repository</div>
								</div>
						    </form>
						</div>
					: 
						<div id='login-form'>
							<a onClick={this.checkSession} href='https://github.com/login/oauth/authorize?client_id=94279adfaa40ab25b712&scope=repo user'>
								<i className='fab fa-github mr-15'></i>
								Connect with GitHub
							</a>
						</div>
				}
			</div>
		)
	}
}

function mapStateToProps(state) {
	return {
		token: state.ui.canvas.token,
		repoFetched: state.repo.fetched,
		repoErrors: state.repo.errors
	}
}

function mapDispatchToProps(dispatch) {
	return {
		setCanvasDisplay: (owner, name) => dispatch(setCanvasDisplay(owner, name)),
		fetchBranches: async (owner, name) => await dispatch(fetchBranches(owner, name)),
		fetchTags: async (owner, name) => await dispatch(fetchTags(owner, name)),
		fetchRepo: async (owner, name) => await dispatch(fetchRepo(owner, name)),
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(Login)