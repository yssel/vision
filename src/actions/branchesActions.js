import { authenticate } from './fetchActions'

async function fetchSelectedBranch(username, reponame, endCursor){
	const branchesFetch = authenticate().next().value;
	let query = `query {
		repository(owner: "${username}", name: "${reponame}"){
			refs(first: 100, refPrefix: "refs/heads/", after: ${endCursor}){
				edges{
					node{
						name
						target {
							...on Commit {
								committedDate
								sha: oid
								message
							}
						}
					}
				}
				pageInfo{
					hasNextPage
					endCursor
				}
			}
		}
	}`

	let response = await branchesFetch({ query });
	return response;
}

export function fetchBranches(username, reponame){
	return async function (dispatch) {
		dispatch({ type: "FETCH_BRANCHES" })
		let branches = {};
		let endCursor = null;
		
		// Fetch all branches
		try {
			while(true){
				// Fetch 100 data from a cursor
				let response = await fetchSelectedBranch(username, reponame, endCursor);
				
				if(!response.errors){
					// Add branches fetched
					response.data.repository.refs.edges.map(
						(edge) => {
							branches[edge.node.name] = edge.node.target
						});

					// Check next page
					let hasNextPage = response.data.repository.refs.pageInfo.hasNextPage;

					if(hasNextPage){
						// Save end cursor
						endCursor = response.data.repository.refs.pageInfo.endCursor;
					}else{
			    		// Dispatch action
						dispatch({
							type: "FETCH_BRANCHES_FULFILLED",
							payload: {
								branches,
								totalCount: Object.keys(branches).length
							}
						})

						break
					}

				}else{
					// Errors encountered in fetch
					dispatch({ 
						type: "FETCH_BRANCHES_REJECTED",
						payload: {
							errors: response.errors
						} 
					});

					break;
				}
			}
		}catch(err){
			// Error
			dispatch({ 
				type: "FETCH_BRANCHES_REJECTED",
				payload: {
					errors: err
				} 
			});
		}
		
	}
}

export function updateBranch(branch, field, value){
	return{
		type: "SET_BRANCH",
		payload: {
			branch,
			field,
			value
		}
	}
}