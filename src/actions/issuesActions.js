import { authenticate, authenticateRest } from './fetchActions'

async function fetchIssuesReq(username, reponame, states){
	const issuesFetch = authenticate().next().value

	let query = `
	query {
		repository(owner: ${username}, name: ${reponame}){
			issues(last: 100, states: ${states}, before: null){
				totalCount
				edges{
					node{
						number
						title
						url
						createdAt
						milestone {
							url
							title
						}
						assignees(first: 10){
							totalCount
							edges{
								node{
									avatarUrl
									url
	                				login
								}
							}
						}
						labels(first: 10){
							totalCount
							edges{
								node{
									color
									name
								}
							}
						}
					}
				}
				pageInfo{
					startCursor
					hasPreviousPage
				}
			}
		}
	}`

	let response = await issuesFetch({ query })
	return response
}

export function fetchIssues(username, reponame){
	return async function(dispatch){
		dispatch({ type: 'FETCH_OPEN_ISSUES'})

		let open_issues = [];
		// 
	}
}

async function fetchIssueReq(username, reponame, issueNumber){
	let link = `https://api.github.com/repos/${username}/${reponame}/issues/${issueNumber}`
	let response = await authenticateRest(link, true)
	return response
}

export function fetchIssue(username, reponame, issueNumber){
	return async function (dispatch){
		dispatch({ type: 'FETCH_ISSUE'})

		try{
			let response = await fetchIssueReq(username, reponame, issueNumber)
			if(!response.errors)
				dispatch({
					type: 'FETCH_ISSUE_FULFILLED',
					payload: {
						issueNumber,
						issue: response
					}
				})
			else{
				dispatch({ 
					type: "FETCH_ISSUE_REJECTED",
					payload: {
						issueNumber,
						errors: response.errors
					} 
				})
			}

		}catch(err){
			dispatch({ 
				type: "FETCH_ISSUE_REJECTED",
				payload: {
					issueNumber,
					errors: err
				} 
			})
		}

	}
}