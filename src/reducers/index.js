import { combineReducers } from 'redux'

// Import all reducers
import repo from './repoReducer'
import branches from './branchesReducer'
import tags from './tagsReducer'
import commits from './commitsReducer'
import issues from './issuesReducer'
import pulls from './pullsReducer'
import ui from './uiReducer'

export default combineReducers({
	repo,
	branches,
	tags,
	commits,
	issues,
	pulls,
	ui
})