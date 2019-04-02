import { authenticate, authenticateRest } from './fetchActions'

async function fetchPullsReq(user, repo){
	let link = `https://api.github.com/repos/${user}/${repo}/pulls`;
	let response = await authenticateRest(link, true);
	return response;
}


export function fetchPulls(username, reponame){
	return async function (dispatch) {
		// Begin fetch
		dispatch({ type: "FETCH_PULLS" })

		try{
			// Fetch repo data
			let response = await fetchPullsReq(username, reponame)
			if(!response.errors){
				dispatch({
					type: "FETCH_PULLS_FULFILLED",
					payload: response
				})
			}else{
				dispatch({
					type: "FETCH_PULLS_REJECTED",
					payload: {
						errors: response.errors
					}
				})
			}
		}catch(err){
			dispatch({
				type: "FETCH_PULLS_REJECTED",
				payload: {
					errors: err
				}
			})
		}

	}
}

export async function getTwoWeekPRs(username, reponame, isMerged=false){
	let today = new Date()
	let sunday = new Date(today.setDate(today.getDate()-7-today.getDay()))
	sunday.setHours(0,0,0,0)
	
	const prsFetch = authenticate().next().value
	let month = sunday.getMonth()+1
	month = month < 10 ? `0${month}` : month
	let day = sunday.getDate() < 10 ? `0${sunday.getDate()}` : sunday.getDate() 
	let date = `${sunday.getFullYear()}-${month}-${day}`

	let keyword = isMerged ? 'merged' : 'created'
	let state = isMerged ? 'closed' : 'open'
	
	let query = `
		query{
		  search(
		    first: 100,
		    type: ISSUE,
		    query: "repo:${username}/${reponame} is:pr ${keyword}:>=${date} state:${state}"
		  ){
		    nodes{
		      ... on PullRequest{
		      	title
		        createdAt
		        mergedAt
		      }
		    }
		    pageInfo{
		      endCursor
		      hasNextPage
		    }
		  }
		}
	`

	let response = await prsFetch({ query })
	if(response.data.search.pageInfo.hasNextPage){
		let issues = response.data.search.nodes
		while(response.data.search.pageInfo.hasNextPage){
			let query = `
				query{
				  search(
				    first: 100,
				    type: ISSUE,
				    query: "repo:${username}/${reponame} is:pr ${keyword}:>=${date} state:${state}"
				  	after: "${response.data.search.pageInfo.endCursor}"
				  ){
				    nodes{
				      ... on PullRequest{
				        createdAt
				        mergedAt
				      }
				    }
				    pageInfo{
				      endCursor
				      hasNextPage
				    }
				  }
				}
			`
			response = await prsFetch({ query })
			issues = issues.concat(response.data.search.nodes)
		}
		return issues
	}else{
		return response.data.search.nodes
	}
}