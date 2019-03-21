import { authenticate, authenticateRest } from './fetchActions'

async function isBranchIncludedReq(user, repo, branch, commit){
	console.log(branch, commit)
	let link = `https://api.github.com/repos/${user}/${repo}/compare/${commit}...${branch}`;
	let response = await authenticateRest(link, true);
	let included = (response.status === 'behind' ||  response.status === 'identical') ? true : false 
	return included;
}

export function isBranchIncluded(user, repo, branch, commit){
	return async function (dispatch){
		dispatch({ type: 'CHECK_BRANCH'})

		try{
			let response = await isBranchIncludedReq(user, repo, branch, commit)
			if(!response.errors)
				dispatch({
					type: 'CHECK_BRANCH_FULFILLED',
					payload: {
						branch,
						valid: response
					}
				})
			else{
				dispatch({ 
					type: "CHECK_BRANCH_REJECTED",
					payload: {
						branch,
						errors: response.errors
					} 
				})
			}

		}catch(err){
			dispatch({ 
				type: "CHECK_BRANCH_REJECTED",
				payload: {
					branch,
					errors: err
				} 
			})
		}

	}
}

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