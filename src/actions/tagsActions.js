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

	let response = await tagsFetch({ query });
	return response;
}

export function fetchTags(username, reponame){
	return async function (dispatch) {
		dispatch({ type: "FETCH_TAGS" })
		let tags = {};
		let endCursor = null;
		
		// Fetch all tags
		try {
			while(true){
				// Fetch 100 data from a cursor
				let response = await fetchSelectedTag(username, reponame, endCursor);
				
				if(!response.errors){
					// Add branches fetched
					response.data.repository.refs.edges.map(
						(edge) => {
							tags[edge.node.name] = edge.node.target
						});

					// Check next page
					let hasNextPage = response.data.repository.refs.pageInfo.hasNextPage;

					if(hasNextPage){
						// Save end cursor
						endCursor = response.data.repository.refs.pageInfo.endCursor;
					}else{
			    		// Dispatch action
						dispatch({
							type: "FETCH_TAGS_FULFILLED",
							payload: {
								tags,
								totalCount: Object.keys(tags).length
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

export function updateTag(tag, field, value){
	return{
		type: "SET_TAG",
		payload: {
			tag,
			field,
			value
		}
	}
}