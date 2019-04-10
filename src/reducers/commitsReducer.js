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