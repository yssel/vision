export default function issuesReducer(state = {
	data: {},
	fetching: false,
	fetched: false,
	errors: null
}, action){
	switch (action.type) {
		case "FETCH_ISSUE":{
			return {
				...state,
				fetching: true,
				fetched: false,
				errors: null
			}
		}

		case "FETCH_ISSUE_FULFILLED":{
			let issues = state.data.issues ? state.data.issues.graph : {}
			let num = Number(action.payload.issueNumber)
			issues[num] = action.payload.issue

			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					issues: {
						...state.data.issues,
						graph: issues
					}
				}
			}
		}

		case "FETCH_ISSUE_REJECTED":{
			return{
				...state,
				fetching: false,
				errors: action.payload.errors
			}	
		}

		case "FETCH_OPEN_ISSUES": {
			return {
				...state,
				fetching: true,
				fetched: false,
				errors: null
			}
		}

		case "FETCH_OPEN_ISSUES_REJECTED": {
			return {
				...state,
				fetching: false,
				errors: action.payload.errors
			}
		}

		case "FETCH_OPEN_ISSUES_FULFILLED": {
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					issues: {
						...state.data.issues,
						open: action.payload.issues
					}
				}
			}
		}

		case "FETCH_CLOSED_ISSUES": {
			return {
				...state,
				fetching: true,
				fetched: false,
				errors: null
			}
		}

		case "FETCH_CLOSED_ISSUES_REJECTED": {
			return {
				...state,
				fetching: false,
				errors: action.payload.errors
			}
		}

		case "FETCH_CLOSED_ISSUES_FULFILLED": {
			return {
				...state,
				fetching: false,
				fetched: true,
				data: {
					issues: {
						...state.data.issues,
						closed: action.payload.issues
					}
				}
			}
		}

		default:{
			return state;
		}
	}
}