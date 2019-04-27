import { createApolloFetch } from 'apollo-fetch'
import store from '../store';

// Returns an authenticated fetch
// Usage: 
// const fetch = authenticate.next().value
export function* authenticate(){
	const uri = 'https://api.github.com/graphql'
	const fetch = createApolloFetch({ uri })
	fetch.use(({ request, options }, next) => {
		// Create the headers object if needed.
		if (!options.headers) {
			options.headers = {}
		}

		options.headers['Access-Control-Request-Headers'] = 'Content-Type, Authorization'
		options.headers['authorization'] =  `token ${store.getState().ui.canvas.token}`
		options.headers['Content-Type'] = 'application/json'
		options.withCredentials = true
		next()
	})
	yield fetch
}

export async function authenticateRest(url, json=false){
	var token = `token ${store.getState().ui.canvas.token}`
	
	let response
	if(json){
		response = await fetch(url, {
		method: 'GET',
		withCredentials: true,
		headers: {
		    'Authorization': token,
		    'Content-Type': 'application/json'}
		}).then(function(response) { return response.json() })
	}else{
		response = await fetch(url, {
		method: 'GET',
		withCredentials: true,
		headers: {
		    'Authorization': token,
		    'Content-Type': 'application/json'}
		})	
	}
	
	return response
}