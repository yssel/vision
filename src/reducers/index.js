import { combineReducers } from 'redux'

// Import all reducers
import repo from './repoReducer'
import branches from './branchesReducer'
import tags from './tagsReducer'
import commits from './commitsReducer'

export default combineReducers({
	repo,
	branches,
	tags,
	commits
})