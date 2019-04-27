export function setCanvasDisplay(field, value){
	return{
		type: "SET_CANVAS_DISPLAY",
		payload: {
			field,
			value
		}
	}
}