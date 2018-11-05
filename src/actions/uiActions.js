export function setActiveTab(tab){
	return {
		type: "SET_ACTIVE_TAB",
		payload: {
			tab
		}
	}
}

export function setCanvasDisplay(field, value){
	return{
		type: "SET_CANVAS_DISPLAY",
		payload: {
			field,
			value
		}
	}
}