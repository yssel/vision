export default function repoReducer(state = {
	data: {},
	fetching: false,
	fetched: false,
	errors: null
}, action){
	switch(action.type){
		case "UPDATE_REPO_DATA": {
			return {
				...state,
				data: {
					...state.data,
					[action.payload.field]: action.payload.value
				}
			}
		}

		case "FETCH_REPO":{
			return {
				...state,
				fetching: true
			}
		}
		
		case "FETCH_REPO_REJECTED":{
			return {
				...state,
				fetching: false,
				errors: action.payload.errors
			}
		}

		case "FETCH_REPO_FULFILLED":{
			return {
				...state,
				data: {
					id: action.payload.id,
					owner: action.payload.owner.login,
					name: action.payload.name,
					description: action.payload.description,
					master_oid: action.payload.defaultBranchRef.target.oid
				},
				fetching: false,
				fetched: true
			}
		}
		
		default:{
			return state
		}
	}
}