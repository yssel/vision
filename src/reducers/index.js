import { combineReducers } from 'redux'

// Import all reducers
import repo from './repoReducer'
import branches from './branchesReducer'
import commits from './commitsReducer'

export default combineReducers({
	repo,
	branches,
	commits
})