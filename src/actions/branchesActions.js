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
								abbreviatedOid
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
		let branches = [];
		let endCursor = null;
		
		// Fetch all branches
		try {
			while(true){
				// Fetch 100 data from a cursor
				let response = await fetchSelectedBranch(username, reponame, endCursor);
				
				if(!response.errors){
					// Build array for newly fetched branches
					let newBranches = response.data.repository.refs.edges.map((edge) => Object.assign({
						name: edge.node.name,
						commit: edge.node.target,
					}));

					// Add newly fetched branches to collection
					branches = branches.concat(newBranches);
					// Check next page
					let hasNextPage = response.data.repository.refs.pageInfo.hasNextPage;

					if(hasNextPage){
						// Save end cursor
						endCursor = response.data.repository.refs.pageInfo.endCursor;
					}else{
						// Sort branch by recent to old
			    		branches.sort(function(a, b) {
							a = new Date(a.latestCommitDate);
							b = new Date(b.latestCommitDate);
							return a>b ? -1 : a<b ? 1 : 0;
						});

			    		// Dispatch action
						dispatch({
							type: "FETCH_BRANCHES_FULFILLED",
							payload: {
								branches: branches,
								totalCount: branches.length
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