export default function branchesReducer(state = {
	data: {},
	fetching: false,
	fetched: false,
	errors: null
}, action){
	switch (action.type) {
		case "FETCH_BRANCHES": {
			return {
				...state,
				fetching: true
			}
		}

		case "FETCH_BRANCHES_REJECTED": {
			return {
				...state,
				fetching: false,
				errors: action.payload.errrors
			}
		}

		case "FETCH_BRANCHES_FULFILLED": {
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					branches: action.payload.branches
				}
			}
		}

		default:{
			return state;
		}
	}
}