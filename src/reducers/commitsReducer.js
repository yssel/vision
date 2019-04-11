export default function commitsReducer(state = {
	data: {
		commits: null,
		files: null
	},
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
					...state.data,
					commits: action.payload.commits
				}
			}
		}

		case "FETCH_COMMIT_FILES":{
			return{
				...state,
				fetching: true,
				fetched: false,
				errors: null
			}
		}

		case "FETCH_COMMIT_FILES_FULFILLED":{
			let files = state.data.files ? state.data.files : {}
			let index = Number(action.payload.index);
			files[index] = action.payload.files;

			return{
				...state,
				fetching: false,
				fetched: true,
				data: {
					...state.data,
					files
				}
			}
		}

		case "FETCH_COMMIT_FILES_REJECTED":{
			return{
				...state,
				fetching: false,
				errors: action.payload.errors
			}
		}

		case "UPDATE_PAGE_COMMITS": {
			let end = action.payload.page * 50
			let commits = [...state.data.commits.slice(0, end), ...action.payload.commits]
			return {
				...state,
				data: {
					...state.data,
					commits
				}
			}
		}

		case "UPDATE_COMMITS": {
			return {
				...state,
				data: {
					...state.data,
					commits: action.payload.commits
				}
			}
		}

		case "ADD_COMMITS": {
			return {
				...state,
				data: {
					...state.data,
					commits: [...state.data.commits, action.payload.commits]
				}
			}
		}

		default:{
			return state
		}		
	}
}