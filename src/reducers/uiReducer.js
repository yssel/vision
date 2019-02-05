export default function uiReducer(state = {
	activeTab: 'home',
	canvas: {
		width: 0,
		height: 0
	}
},action) {
	switch(action.type){
		case "SET_ACTIVE_TAB" : {
			return {
				...state,
				activeTab: action.payload.tab
			}
		}

		case "SET_CANVAS_DISPLAY" : {
			return {
				...state,
				canvas: {
					...state.canvas,
					[action.payload.field]: action.payload.value
				}
			}
		}

		default: {
			return state
		}
	}
}