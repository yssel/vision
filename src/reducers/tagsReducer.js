export default function tagsReducer(state = {
	data: {},
	fetching: false,
	fetched: false,
	errors: null
}, action){
	switch (action.type) {
		case "FETCH_TAGS": {
			return {
				...state,
				fetching: true
			}
		}

		case "FETCH_TAGS_REJECTED": {
			return {
				...state,
				fetching: false,
				errors: action.payload.errrors
			}
		}

		case "FETCH_TAGS_FULFILLED": {
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					tags: action.payload.tags
				}
			}
		}

		case "CHECK_TAG": {
			return {
				...state,
				fetching: true
			}
		}

		case "CHECK_TAG_REJECTED": {
			return {
				...state,
				fetching: false,
				errors: action.payload.errrors
			}
		}

		case "CHECK_TAG_FULFILLED": {
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					tags: {
						...state.data.tags,
						[action.payload.tag]: {
							...state.data.tags[action.payload.tag],
							valid: action.payload.valid
						}
					}
				}
			}
		}

		default:{
			return state;
		}
	}
}