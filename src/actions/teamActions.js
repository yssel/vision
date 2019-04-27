import { authenticate, authenticateRest } from './fetchActions';

export async function getAssignees(user,repo, cursor=null){
	const teamFetch = authenticate().next().value
	let query = `
		query {
			repository(owner: "${user}", name: "${repo}"){
			assignableUsers(first: 100, after: ${cursor}){
		      totalCount
		      nodes{
		        avatarUrl
		        name
		        login
		      }
		      pageInfo{
		        hasNextPage
		        endCursor
		      }
		    }
			}
		}
	`
	let response = await teamFetch({ query })
	return response
}

export async function getAssigneeIssues(user, repo, assignee){
	let link = `https://api.github.com/search/issues?q=repo:${user}/${repo} assignee:${assignee} state:open type:issue`
	let response = await authenticateRest(link, true);
	return response
}