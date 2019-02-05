import { authenticate } from './fetchActions'

export function updateRepo(field, value){
	return {
		type: 'UPDATE_REPO_DATA',
		payload: {
			field,
			value
		}
	}
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
			defaultBranchRef { target { sha: oid } }
		}
	}`

	let response = await repoFetch({ query })
	return response
}


export function fetchRepo(username, reponame){
	return async function (dispatch) {
		// Begin fetch
		dispatch({ type: "FETCH_REPO", payload: null })

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