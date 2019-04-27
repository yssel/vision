import { authenticate, authenticateRest } from './fetchActions'

export function updateRepo(field, value){
	return {
		type: 'UPDATE_REPO_DATA',
		payload: {
			field,
			value
		}
	}
}

export async function getUser(){
	let link = `https://api.github.com/user`
	let response = await authenticateRest(link, true)	
	return response
}

async function fetchRepoData(username, reponame){
	// Initialize authenticated fetch request
	const repoFetch = authenticate().next().value
	let query = ` query {
		repository (name: "${reponame}", owner: "${username}") {
			id
			owner {	login }
			name
			description
			defaultBranchRef { 
				name
				target { 
					sha: oid 
				} 
			}
		}
	}`

	let response = await repoFetch({ query })
	return response
}


export function fetchRepo(username, reponame){
	return async function (dispatch) {
		// Begin fetch
		dispatch({ type: "FETCH_REPO", payload: username, reponame })

		try{
			// Fetch repo data
			let response = await fetchRepoData(username, reponame)
			if(!response.errors){
				dispatch({
					type: "FETCH_REPO_FULFILLED",
					payload: response.data.repository
				})
			}else{
				dispatch({
					type: "FETCH_REPO_REJECTED",
					payload: {
						errors: response.errors
					}
				})
			}
		}catch(err){
			dispatch({
				type: "FETCH_REPO_REJECTED",
				payload: {
					errors: err
				}
			})
		}

	}
}