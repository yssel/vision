export default function commitsReducer(state = {
	data: {},
	fetching: false,
	fetched: false,
	errors: null
}, action){
	switch(action.type){
		case "FETCH_COMMITS": {
			return {
				...state,
				fetching: true
			}
		}

		case "FETCH_COMMITS_REJECTED":{
			return {
				...state,
				fetching: false,
				errors: action.payload.errors
			}
		}

		case "FETCH_COMMITS_FULFILLED":{
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					commits: action.payload.commits
				}
			}
		}

		case "UPDATE_COMMITS": {
			return {
				...state,
				data: {
					commits: action.payload.commits
				}
			}
		}

		default:{
			return state
		}		
	}
}