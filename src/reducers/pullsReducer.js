export default function pullsReducer(state = {
	data: {
		pulls: null
	},
	fetching: false,
	fetched: false,
	errors: null
}, action){
	switch(action.type){
		case "FETCH_PULLS": {
			return {
				...state,
				fetching: true
			}
		}

		case "FETCH_PULLS_REJECTED":{
			return {
				...state,
				fetching: false,
				errors: action.payload.errors
			}
		}

		case "FETCH_PULLS_FULFILLED":{
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					...state.data,
					pulls: action.payload
				}
			}
		}

		case "UPDATE_PULLS": {
			return {
				...state,
				data: {
					...state.data,
					pulls: action.payload
				}
			}
		}

		default:{
			return state
		}		
	}
}