import { authenticate } from './fetchActions'

async function fetchSelectedTag(username, reponame, endCursor){

	const tagsFetch = authenticate().next().value;
	let query = `query {
		repository(owner: "${username}", name: "${reponame}"){
			refs(first: 100, refPrefix: "refs/tags/", after: ${endCursor}){
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

	let response = await tagsFetch({ query });
	return response;
}

export function fetchTags(username, reponame){
	return async function (dispatch) {
		dispatch({ type: "FETCH_TAGS" })
		let tags = [];
		let endCursor = null;
		
		// Fetch all tags
		try {
			while(true){
				// Fetch 100 data from a cursor
				let response = await fetchSelectedTag(username, reponame, endCursor);
				
				if(!response.errors){
					// Build array for newly fetched tags
					let newTags = response.data.repository.refs.edges.map((edge) => Object.assign({
						name: edge.node.name,
						commit: edge.node.target,
					}));

					// Add newly fetched tags to collection
					tags = tags.concat(newTags);
					// Check next page
					let hasNextPage = response.data.repository.refs.pageInfo.hasNextPage;

					if(hasNextPage){
						// Save end cursor
						endCursor = response.data.repository.refs.pageInfo.endCursor;
					}else{
						// Sort tag by recent to old
			    		tags.sort(function(a, b) {
							a = new Date(a.latestCommitDate);
							b = new Date(b.latestCommitDate);
							return a>b ? -1 : a<b ? 1 : 0;
						});

			    		// Dispatch action
						dispatch({
							type: "FETCH_TAGS_FULFILLED",
							payload: {
								tags: tags,
								totalCount: tags.length
							}
						})

						break
					}

				}else{
					// Errors encountered in fetch
					dispatch({ 
						type: "FETCH_TAGS_REJECTED",
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
				type: "FETCH_TAGS_REJECTED",
				payload: {
					errors: err
				} 
			});
		}
		
	}
}