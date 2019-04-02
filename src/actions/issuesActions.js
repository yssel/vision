import { authenticate, authenticateRest } from './fetchActions'

export async function fetchAssigneesIssues(username, reponame){
	let assignees = []
	// Get assignees
	let link = `https://api.github.com/repos/${username}/${reponame}/assignees`
	let response = await authenticateRest(link)
	let headerLink = response.headers.get('Link')
	if(headerLink){
		let page = 1
		let lastPage = Number(headerLink.match(/page=(\d*)>; rel="last"/)[1])
		while(page <= lastPage){
			let page_link = `${link}?page=${page}`
			response = await authenticateRest(page_link, true)
			assignees = assignees.concat(response)
			page++
		}
	}else{
		response = await authenticateRest(link, true)
		assignees = response
	}

	return assignees
}

export async function fetchLabels(username, reponame){
	const issuesFetch = authenticate().next().value

	let query = `
	query {
		repository(owner: "${username}", name: "${reponame}"){
			labels(first: 100){
				nodes{
			        issues(first: 0){
			          totalCount
			        }
			        color
			        name
			        url
				}
				pageInfo{
					endCursor
					hasNextPage
				}
			}
		}
	}`

	let response = await issuesFetch({ query })
	let labels = response.data.repository.labels.nodes
	while(response.data.repository.labels.pageInfo.hasNextPage){
		let query = `
			query {
				repository(owner: "${username}", name: "${reponame}"){
					labels(first: 100, after: "${response.data.repository.labels.pageInfo.endCursor}"){
						nodes{
					        issues(first: 0){
					          totalCount
					        }
					        color
					        name
					        url
						}
						pageInfo{
							endCursor
							hasNextPage
						}
					}
				}
			}`
		response = await issuesFetch({ query })
		labels = labels.concat(response.data.repository.labels.nodes)
	}
	return labels
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

export async function fetchIssuesCount(username, reponame){
	const issuesFetch = authenticate().next().value

	let query = `
	query {
		repository(owner: "${username}", name: "${reponame}"){
			open: issues(last: 0, states: OPEN){
				totalCount
			}
			closed: issues(last: 1, states: CLOSED){
				totalCount
			}
		}
	}`

	let response = await issuesFetch({ query })
	return { open: response.data.repository.open.totalCount, closed: response.data.repository.closed.totalCount }
}

export async function getTwoWeekIssues(username, reponame, state='open'){
	let today = new Date()
	let sunday = new Date(today.setDate(today.getDate()-7-today.getDay()))
	sunday.setHours(0,0,0,0)
	
	const issuesFetch = authenticate().next().value
	let month = sunday.getMonth()+1
	month = month < 10 ? `0${month}` : month
	let day = sunday.getDate() < 10 ? `0${sunday.getDate()}` : sunday.getDate() 
	let date = `${sunday.getFullYear()}-${month}-${day}`

	let keyword = state==='open' ? 'created' : 'closed'
	
	let query = `
		query{
		  search(
		    first: 100,
		    type: ISSUE,
		    query: "repo:${username}/${reponame} is:issue ${keyword}:>=${date} state:${state}"
		  ){
		    nodes{
		      ... on Issue{
		      	title
		        createdAt
		        closedAt
		      }
		    }
		    pageInfo{
		      endCursor
		      hasNextPage
		    }
		  }
		}
	`

	let response = await issuesFetch({ query })
	if(response.data.search.pageInfo.hasNextPage){
		let issues = response.data.search.nodes
		while(response.data.search.pageInfo.hasNextPage){
			let query = `
				query{
				  search(
				    first: 100,
				    type: ISSUE,
				    query: "repo:${username}/${reponame} is:issue ${keyword}:>=${date} state:${state}"
				  	after: "${response.data.search.pageInfo.endCursor}"
				  ){
				    nodes{
				      ... on Issue{
				        createdAt
				        closedAt
				      }
				    }
				    pageInfo{
				      endCursor
				      hasNextPage
				    }
				  }
				}
			`
			response = await issuesFetch({ query })
			issues = issues.concat(response.data.search.nodes)
		}
		return issues
	}else{
		return response.data.search.nodes
	}
}