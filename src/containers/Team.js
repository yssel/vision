import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getAssignees, getAssigneeIssues } from '../actions/teamActions';
import '../styles/Team.css';

class Team extends Component {
	constructor(props){
		super(props);
		this.state = {
			team: null,
			member: null,
			issues_viewed: {},
			issue_viewed: null
		}
	}

	getAssignees = async () => {
		let assignees = await getAssignees(this.props.username, this.props.reponame);
		let team = assignees.data.repository.assignableUsers
		this.setState({ team_page: team.pageInfo, team_total: team.totalCount, team: team.nodes })
	}

	dateInWords = (date) => {
        let options = { year: 'numeric', month: 'long', day: 'numeric' };
        date = new Date(date)
        return date.toLocaleString('en-US', options)
    }

	getTextColor = (hex, convert) =>{
        // Code snippet from https://stackoverflow.com/a/12043228
        if(convert) hex = this.RGBToHex(hex);

        let rgb = parseInt(hex, 16);   // convert rrggbb to decimal
        let r = (rgb >> 16) & 0xff;  // extract red
        let g = (rgb >>  8) & 0xff;  // extract green
        let b = (rgb >>  0) & 0xff;  // extract blue

        let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma < 128) return 'white'
        else return 'black'
    }

	handleClick = async (login, e) => {
		if(this.state.member !== login){
			this.setState({ member: login, issue_viewed: null })
			if(!this.state.issues_viewed[login]){
				this.setState({ issues_viewed: { ...this.state.issues_viewed, [login]: { fetching: true } }})
				let issues = await getAssigneeIssues(this.props.username, this.props.reponame, login)
				this.setState({ 
					issues_viewed: { 
						...this.state.issues_viewed, 
						[login]: { 
							...issues,
							fetching: false
						} 
					}
				})
			}
		}
	}

	handleModuleClick = (issue, e) =>{
		this.setState({ issue_viewed: issue })
	}

	componentDidMount(){
		this.getAssignees()
	}

	render(){
		const { team, issues_viewed, issue_viewed, member, team_total } = this.state;

		return(
			<div id='team-page'>
				<div id='assignees'>
					<div className='header'>
						<div className='title'>Members</div>
						{team_total && <div className='count'>{team_total}</div>}
					</div>
					<div className='list'>
					<div className='block'>
					{ team && team.map((m, i) => {
						return(
							<div className='member' key={i} onClick={(e) => this.handleClick(m.login, e)} style={{ background: m.login === member ? '#b9ceeb' : 'white' }}>
								<div className='avatar'>
									<img src={m.avatarUrl} alt=''/>
								</div>
								<div className='detail'>
									<div className='name'>{m.name}</div>
									<div className='login'>@{m.login}</div>
								</div>
							</div>
						)
					})}
					</div>
					</div>
				</div>
				<div id='assignee-issues'>
					<div className='header'>
						<div className='title'>Modules</div> 
						{issues_viewed[member] && <div className='count'>{issues_viewed[member].total_count}</div>}
					</div>

					{ !member &&
						<div className='null'>Select a member</div>
					}

					{ member && issues_viewed[member] && !issues_viewed[member].fetching && 
						<div className='list'>
						<div className='block'>
							{ issues_viewed[member].items.map((issue, i) => {
							return(
								<div className='issue' key={i} onClick={(e) => this.handleModuleClick(issue, e)} style={{ background: issue_viewed && issue_viewed.number === issue.number ? '#eaf5ff' : 'white' }}>
                                    <div className='issue-info'>
                                        <div className='issue-data'>
                                            <div className='issue-title'>{issue.title}<span className='issue-number'><a href={issue.html_url}>#{issue.number}</a></span></div>
                                            {issue.milestone && 
                                                <div className='issue-milestone'>
                                                    <i className='fas fa-flag'></i>
                                                    {issue.milestone.title}
                                                </div>
                                            }
                                        </div>
                                    </div>
                                    {issue.labels.length > 0 && <div className='issue-labels'>
                                        {issue.labels.map((label, i) => {
                                            return(
                                                <div className='issue-label' key={i} 
                                                    style={{ 
                                                        background: `#${label.color}`,
                                                        color: this.getTextColor(label.color)
                                                    }}>

                                                    {label.name}
                                                </div>
                                            )
                                        })}
                                    </div>}
                                    <div className='divider'></div>
                                    {issue.assignees.length > 0 && <div className='issue-assignees'>
                                        {issue.assignees.map((user, i) => {
                                            return(
                                                <div className='issue-assignee' key={i}>
                                                    <img alt='' src={user.avatar_url}/>
                                                </div>
                                            )
                                        })}
                                    </div>}
								</div>
							)
							})}
						</div>
						</div>
					}

					{ member && issues_viewed[member] && issues_viewed[member].fetching && 
						<div className='null'>
							<i className="fas fa-circle-notch fa-spin"></i>
						</div>
					}
				</div>
				<div id='full-issue'>
					{ !issue_viewed &&
						<div className='null'>Select a module</div>
					}
					{ issue_viewed && 
						<div className='block'>
							<div className='number'>#{issue_viewed.number}</div>
							<div className='title'>{issue_viewed.title}</div>
							<div className='opened'>
								<div className='author'>
									<img src={issue_viewed.user.avatar_url} alt=''/>
								</div>
								<div>
									<span className='username mr-5'>@{issue_viewed.user.login}</span>
									<span>opened this on </span>
									<span className='date'>{this.dateInWords(issue_viewed.created_at)}</span>
								</div>
							</div>
							<div className='body'>{issue_viewed.body}</div>
						</div>
					}
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

export default connect(mapStateToProps)(Team)