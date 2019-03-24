import { authenticateRest } from './fetchActions'

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